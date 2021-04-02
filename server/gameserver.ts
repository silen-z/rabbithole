import { World, System } from "ecsy";
import { WebSocket, isWebSocketCloseEvent } from "ws";
import { v4 } from "uuid";
import type { Configuration } from "./configuration.ts";
import { Machine, interpret, spawn, assign, sendParent } from "xstate";
import { TickScheduler } from "../shared/tickscheduler.ts";

export class GameServer {
  config: Configuration;

  world = new World();

  tickScheduler = new TickScheduler();

  service = interpret(
    GameServerMachine.withContext({
      ...GameServerMachine.context,
      world: this.world,
    }),
    { clock: this.tickScheduler }
  );

  constructor(config: Configuration) {
    this.config = config;
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
  | { type: "PLAYER_DISCONNECTED"; id: string };

interface GameServerContext {
  lobbyTimer: number;
  world: World;
  players: Record<string, any>;
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

          const actorRef = spawn(
            PlayerConnection.withContext({ id, socket: e.socket }),
            `player-${id}`
          );

          return { ...ctx.players, [id]: actorRef };
        },
      }),
    },

    PLAYER_DISCONNECTED: {
      actions: assign({
        players: (ctx, e) => {
          console.log(`GAMESERVER: Player ${e.id} disconnected`);
          ctx.players[e.id].stop();
          return without(e.id, ctx.players);
        },
      }),
    },
  },
  states: {
    lobby: {
      after: {
        10000: "loading",
      },
      entry: (context) => {
        console.log("enabling lobby system");
        context.world.getSystem(LobbySystem).play();
      },
      exit: (context) => {
        context.world.getSystem(LobbySystem).stop();
      },
    },
    loading: {
      entry: () => {
        console.log("loading...");
      },
    },
    playing: {},
  },
});

interface PlayerConnectionContext {
  socket: WebSocket;
  id: string;
  nickname?: string;
}

type PlayerConnectionEvents =
  | { type: "IDENTIFY"; nickname: string }
  | { type: "PLAYER_DISCONNECTED" };

const PlayerConnection = Machine<
  PlayerConnectionContext,
  PlayerConnectionEvents
>({
  initial: "waiting_for_id",
  invoke: {
    src: (ctx) => async (callback) => {
      for await (const event of ctx.socket) {
        if (isWebSocketCloseEvent(event)) {
          callback({ type: "PLAYER_DISCONNECTED" });
          break;
        }

        if (typeof event !== "string") {
          console.log(`Received invalid data from ${ctx.id}`);
          continue;
        }

        const data = JSON.parse(event);
        console.log(`Received data from player ${ctx.id}: ${event}`);
        callback(data);
      }
    },
  },
  on: {
    PLAYER_DISCONNECTED: "disconnected",
  },
  states: {
    waiting_for_id: {
      on: {
        IDENTIFY: {
          target: "idle",
          actions: [
            assign({ nickname: (ctx, e) => e.nickname }),
            (ctx, e) => {
              console.log(
                `GAMESERVER: Player ${ctx.id} identified with name ${e.nickname}`
              );
            },
          ],
        },
      },
      entry: (ctx) => {
        console.log(`GAMESERVER: Actor spawned for player: ${ctx.id}`);
      },
    },

    idle: {},
    disconnected: {
      entry: sendParent((ctx) => ({ type: "PLAYER_DISCONNECTED", id: ctx.id })),
      type: "final",
    },
  },
});

function without<T, K extends keyof T>(omitKey: K, obj: T): Omit<T, K> {
  const newObj = {} as Omit<T, K>;
  for (const [key, value] of Object.entries(obj)) {
    if (key !== omitKey) {
      // @ts-ignore ^
      newObj[key] = value;
    }
  }
  return newObj;
}
