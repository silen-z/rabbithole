import { Machine, assign, forwardTo, send, sendParent, Sender, Receiver, AnyEventObject } from "xstate";
import { ClientEvent } from "./client";
import { ClientDecoder } from "./client-packet-decoder";

export type ConnectionEvent =
  | { type: "CONNECT"; address: string }
  | { type: "SOCKET_READY" }
  | { type: "SOCKET_CLOSED" }
  | { type: "SUBMIT_QUEUE"; queue: ArrayBuffer[] }
  | { type: "SEND"; packet: ArrayBuffer }
  | { type: "RECEIVE"; event: ClientEvent };

interface ConnectionContext {
  address: string;
  queue: ArrayBuffer[];
}

export const Connection = (address: string) =>
  Machine<ConnectionContext, ConnectionEvent>({
    strict: true,
    initial: "disconnected",
    context: {
      address,
      queue: [],
    },
    states: {
      disconnected: {
        on: {
          CONNECT: "connected",
          SEND: {
            actions: assign({ queue: (ctx, e) => [...ctx.queue, e.packet] }),
          },
        },
      },
      connected: {
        initial: "connecting",
        states: {
          connecting: {
            on: {
              SOCKET_READY: "ready",
              SEND: {
                actions: assign({ queue: (ctx, e) => [...ctx.queue, e.packet] }),
              },
            },
          },
          ready: {
            entry: [
              send((ctx) => ({ type: "SUBMIT_QUEUE", queue: ctx.queue }), {
                to: "socket",
              }),
              // TODO clearing the queue assign({ queue: (ctx) => [] }),
            ],
            on: {
              SEND: {
                actions: forwardTo("socket"),
              },
              RECEIVE: {
                actions: sendParent((_, e) => e.event),
              },
            },
          },
        },
        on: {
          SOCKET_CLOSED: "disconnected",
        },

        invoke: {
          id: "socket",
          onError: {
            actions: (_, e) => {
              console.log(e);
            },
          },
          src: (ctx) => (sender: Sender<ConnectionEvent>, receiver: Receiver<ConnectionEvent | AnyEventObject>) => {
            let socket = new WebSocket(ctx.address);

            receiver((event) => {
              if (event.type === "SEND") {
                console.log("sending packet to server", event.packet);
                socket.send(event.packet);
              }

              if (event.type === "SUBMIT_QUEUE") {
                console.log(`submiting queue of ${event.queue.length} packets`);
                for (const packet of event.queue) {
                  console.log("sending packet to server", packet);
                  socket.send(packet);
                }
              }
            });

            socket.addEventListener("open", () => {
              sender({ type: "SOCKET_READY" });
            });

            socket.addEventListener("message", async (message) => {
              if (!(message.data instanceof Blob)) {
                console.log(`received invalid packet from server: `, message.data);
                return;
              }

              const buffer = await message.data.arrayBuffer();
              const event = ClientDecoder.decode(buffer);
              sender({ type: "RECEIVE", event });
            });

            socket.addEventListener("close", () => {
              sender({ type: "SOCKET_CLOSED" });
            });

            return () => socket.close();
          },
        },
      },
    },
  });
