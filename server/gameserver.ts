import { Machine, interpret, spawn, send, actions, SendAction, EventObject, SpawnedActorRef } from "xstate";
import { assign } from "@xstate/immer";
import { WebSocket } from "ws";
import { World } from "../shared/ecs.ts";
import { v4 } from "uuid";

import type { Configuration } from "./configuration.ts";
import { TickScheduler } from "../shared/tickscheduler.ts";
import { PlayerConnection, PlayerConnectionEvent } from "./player-connection.ts";

export class GameServer {
  world = new World();

  tickScheduler = new TickScheduler();

  service = interpret(GameServerMachine(this.world), { clock: this.tickScheduler });

  constructor(private config: Configuration) {}

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

  handleConnection(socket: WebSocket) {
    this.service.send({ type: "PLAYER_CONNECTED", socket });
  }
}

type PlayerIdentifyEvent = {
  type: "PLAYER_IDENTIFY";
  id: string;
  nickname: string;
};

type GameServerEvent =
  | { type: "PLAYER_CONNECTED"; socket: WebSocket }
  | { type: "PLAYER_DISCONNECTED"; id: string }
  | PlayerIdentifyEvent;

interface Player {
  id: string;
  connRef: SpawnedActorRef<PlayerConnectionEvent>;
  nickname?: string;
}

interface GameServerContext {
  world: World<unknown>;
  players: Record<string, Player>;
}

const GameServerMachine = (world: World<unknown>) =>
  Machine<GameServerContext, GameServerEvent>({
    initial: "lobby",
    context: {
      world,
      players: {},
    },
    on: {
      PLAYER_CONNECTED: {
        actions: assign((ctx, e) => {
          const id = v4.generate();
          console.log(`GAMESERVER: Player ${id} connected`);
          const connRef = spawn(PlayerConnection.withContext({ id, socket: e.socket }), `player-${id}`);

          ctx.players[id] = { connRef, id };
        }),
      },

      PLAYER_DISCONNECTED: {
        actions: [
          (ctx, e) => {
            console.log(`GAMESERVER: Player ${e.id} disconnected`);
            // TODO error: Uncaught (in promise) TypeError: Cannot read property 'connRef' of undefined
            ctx.players[e.id]?.connRef.stop?.();
          },
          assign((ctx, e) => {
            delete ctx.players[e.id];
          }),
        ],
      },

      PLAYER_IDENTIFY: {
        actions: actions.choose<GameServerContext, PlayerIdentifyEvent>([
          {
            cond: (ctx, e) => Object.values(ctx.players).some((p) => p.nickname === e.nickname),
            actions: sendToPlayer({ type: "IDENTITY_REJECT", reason: "Nickname already exists" }),
          },
          {
            actions: [
              assign((ctx, e) => {
                ctx.players[e.id]!.nickname = e.nickname;
              }),
              sendToPlayer({ type: "IDENTITY_CONFIRM" }),
            ],
          },
        ]),
      },
    },
    states: {
      lobby: {},
    },
  });

interface PlayerRelatedEvent extends EventObject {
  id: string;
}

function sendToPlayer<E extends PlayerRelatedEvent>(
  event: PlayerConnectionEvent
): SendAction<GameServerContext, E, PlayerConnectionEvent> {
  return send(event, { to: (_, e: E) => `player-${e.id}` });
}
