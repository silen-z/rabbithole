import { World, System } from "ecsy";
import { WebSocket, isWebSocketCloseEvent } from "ws";
import { v4 } from "uuid";
import type { Configuration } from "./configuration.ts";
import { Machine, interpret, spawn, assign, sendParent, ActorRefFrom, Interpreter, forwardTo } from "xstate";
import { TickScheduler } from "../shared/tickscheduler.ts";
import { ServerDecoder } from "./packet-decoder.ts";
import { without } from "../shared/utils.ts";

export class GameServer {
  world = new World();

  tickScheduler = new TickScheduler();

  service = interpret(
    GameServerMachine.withContext({
      ...GameServerMachine.context,
      world: this.world,
    }),
    { clock: this.tickScheduler }
  );

  constructor(private config: Configuration) {
    this.world.registerSystem(LobbySystem, { gameState: this.service });
  }

  start() {
    console.log(`GAMESERVER: starting...`);

    let previous = performance.now();
    const tickLengthMs = 1000 / this.config.tickRate;

    this.service.start();

    const loop = () => {
      setTimeout(loop, tickLengthMs);
      const now = performance.now();
      const elapsed = now - previous;
      const delta = elapsed / 1000;
      this.tickScheduler.tick(elapsed);
      this.world.execute(delta, now);
      previous = now;
    };

    loop();
  }

  update() {}

  handleConnection(socket: WebSocket) {
    this.service.send({ type: "PLAYER_CONNECTED", socket });
  }
}

class LobbySystem extends System {
  gameService!: GameServer["service"];
  enabled = false;

  init(attrs: { gameService: GameServer["service"] }) {
    this.gameService = attrs.gameService;
  }

  execute() {}
}

type GameServerEvents =
  | { type: "PLAYER_CONNECTED"; socket: WebSocket }
  | { type: "PLAYER_DISCONNECTED"; id: string }
  | { type: "PLAYER_IDENTIFY"; id: string; nickname: string };

interface GameServerContext {
  lobbyTimer: number;
  world: World;
  players: Record<string, PlayerConnectionRef>;
}

const GameServerMachine = Machine<GameServerContext, GameServerEvents>({
  initial: "lobby",
  context: {
    players: {},
    //@ts-ignore gets assigned in GameServer
    world: undefined,
  },
  on: {
    PLAYER_CONNECTED: {
      actions: assign({
        players: (ctx, e) => {
          const id = v4.generate();

          console.log(`GAMESERVER: Player ${id} connected`);

          const actorRef = spawn(PlayerConnection.withContext({ id, socket: e.socket }), `player-${id}`);

          return { ...ctx.players, [id]: actorRef };
        },
      }),
    },

    PLAYER_DISCONNECTED: {
      actions: assign({
        players: (ctx, e) => {
          console.log(`GAMESERVER: Player ${e.id} disconnected`);
          ctx.players[e.id]?.stop?.();
          return without(e.id, ctx.players);
        },
      }),
    },

    PLAYER_IDENTIFY: {
      actions: (ctx, e) => {
        ctx.players[e.id].send({ type: "IDENTITY_CONFIRM" });
      },
    },
  },
  states: {
    lobby: {},
  },
});

interface PlayerConnectionContext {
  socket: WebSocket;
  id: string;
  nickname?: string;
}

type PlayerConnectionEvents =
  | { type: "IDENTIFY"; nickname: string }
  | { type: "DISCONNECTED" }
  | { type: "IDENTITY_CONFIRM" }
  | { type: "IDENTITY_REJECT" };

const PlayerConnection = Machine<PlayerConnectionContext, PlayerConnectionEvents>({
  id: "client-actor",
  initial: "connected",
  entry: (ctx) => {
    console.log(`GAMESERVER: Actor spawned for player: ${playerName(ctx)}`);
  },
  states: {
    connected: {
      // after: {
      //   3000: {
      //     actions: send("IDENTITY_CONFIRM", { to: "socket" }),
      //   },
      // },
      invoke: {
        id: "socket",
        onError: {
          actions: (ctx, e) => {
            console.log(`GAMESERVER: ERROR in player actor ${playerName(ctx)}: `, e);
          },
        },
        src: (ctx) => (callback, receive) => {
          receive((event) => {
            console.log(`sending event to player ${playerName(ctx)}, event: `, event);
            ctx.socket.send(JSON.stringify(event));
          });

          // TODO callback invoked by XState can't be async because receiving paren events wouldn't work
          (async () => {
            for await (const message of ctx.socket) {
              if (isWebSocketCloseEvent(message)) {
                callback({ type: "DISCONNECTED" });
                break;
              }

              if (message instanceof Uint8Array) {
                const event = ServerDecoder.decode(message.buffer);
                console.log(`received event from player: ${playerName(ctx)}, event: `, event);
                callback(event);
              } else {
                console.log(`received invalid data from player: ${playerName(ctx)}, data:`, message);
                continue;
              }
            }
          })();

          return () => {
            if (!ctx.socket.isClosed) {
              ctx.socket.close();
            }
          };
        },
      },

      initial: "waiting_for_id",
      states: {
        waiting_for_id: {
          on: {
            IDENTIFY: {
              actions: sendParent((ctx, e) => ({
                type: "PLAYER_IDENTIFY",
                id: ctx.id,
                nickname: e.nickname,
              })),
            },
            IDENTITY_CONFIRM: {
              target: "idle",
              actions: forwardTo("socket"),
            },
            IDENTITY_REJECT: {
              actions: forwardTo("socket"),
            },
          },
        },

        idle: {},
      },
      on: {
        DISCONNECTED: "disconnected",
      },
    },

    disconnected: {
      entry: sendParent((ctx) => ({ type: "PLAYER_DISCONNECTED", id: ctx.id })),
      type: "final",
    },
  },
});

type PlayerConnectionRef = ActorRefFrom<Interpreter<PlayerConnectionContext, any, PlayerConnectionEvents>["machine"]>;

function playerName(ctx: PlayerConnectionContext): string {
  if (ctx.nickname == null) {
    return ctx.id;
  }

  return `${ctx.id} (${ctx.nickname})`;
}
