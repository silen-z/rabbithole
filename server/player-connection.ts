import { Machine, send, sendParent, EventObject, SendAction, Sender, AnyEventObject, Receiver } from "xstate";
import { WebSocket, isWebSocketCloseEvent } from "ws";

import { IdentityConfirm, IdentityReject, Identify } from "../shared/packets.ts";
import { PacketDecoder } from "../shared/packet-lib.ts";

interface PlayerConnectionContext {
  socket: WebSocket;
  id: string;
}

export type PlayerConnectionEvent =
  | Identify
  | { type: "IDENTITY_CONFIRM" }
  | { type: "IDENTITY_REJECT"; reason: string }
  | { type: "SEND"; packet: ArrayBuffer }
  | { type: "DISCONNECTED" };

export const PlayerConnection = Machine<PlayerConnectionContext, PlayerConnectionEvent>({
  id: "client-actor",
  initial: "connected",
  entry: (ctx) => {
    console.log(`GAMESERVER: Actor spawned for player: ${playerName(ctx)}`);
  },
  states: {
    connected: {
      invoke: {
        id: "socket",
        onError: {
          actions: (ctx, e) => {
            console.log(`GAMESERVER: ERROR in player actor ${playerName(ctx)}: `, e);
          },
        },
        src: (ctx) => (
          sender: Sender<PlayerConnectionEvent>,
          receive: Receiver<PlayerConnectionEvent | AnyEventObject>
        ) => {
          receive((event) => {
            if (event.type === "SEND") {
              ctx.socket.send(new Uint8Array(event.packet));
            }
          });

          async function receiveFromSocket() {
            for await (const message of ctx.socket) {
              if (isWebSocketCloseEvent(message)) {
                sender({ type: "DISCONNECTED" });
                break;
              }

              if (message instanceof Uint8Array) {
                const event = ServerDecoder.decode(message.buffer);
                console.log(`received event from player: ${playerName(ctx)}, event: `, event);
                sender(event);
              } else {
                console.log(`received invalid data from player: ${playerName(ctx)}, data:`, message);
                continue;
              }
            }
          }

          receiveFromSocket();

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
              actions: sendPacket(() => IdentityConfirm()),
            },
            IDENTITY_REJECT: {
              actions: sendPacket((_, e) => IdentityReject({ reason: e.reason })),
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

function sendPacket<E extends EventObject>(
  toPacket: (ctx: PlayerConnectionContext, e: E) => ArrayBuffer
): SendAction<PlayerConnectionContext, E, PlayerConnectionEvent> {
  return send((ctx, e) => ({ type: "SEND", packet: toPacket(ctx, e) }), { to: "socket" });
}

function playerName(ctx: PlayerConnectionContext): string {
  return `${ctx.id}`;
}

const ServerDecoder = new PacketDecoder().register(Identify);
