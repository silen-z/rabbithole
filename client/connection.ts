import { Machine, assign, forwardTo, send, sendParent, Sender, Receiver } from "xstate";
import { ClientEvent } from "./client";

type ConnectionEvent =
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

export const Connection = Machine<ConnectionContext, any, ConnectionEvent>({
  strict: true,
  initial: "disconnected",
  context: {
    address: null,
    queue: [],
  },
  states: {
    disconnected: {
      on: {
        CONNECT: {
          target: "connected",
          actions: assign({ address: (ctx, e) => e.address }),
        },
        SEND: {
          actions: assign({ queue: (ctx, e) => [...ctx.queue, e.packet] }),
        },
      },
    },
    connected: {
      initial: "connecting",
      // @ts-ignore
      invoke: {
        id: "socket",
        src: (ctx) => (sender: Sender<ConnectionEvent>, receiver: Receiver<ConnectionEvent>) => {
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

          socket.addEventListener("message", (message) => {
            const event = JSON.parse(message.data);
            sender({ type: "RECEIVE", event });
          });

          socket.addEventListener("close", () => {
            sender({ type: "SOCKET_CLOSED" });
          });

          return () => socket.close();
        },
        onError: (ctx, e) => {
          console.log(e);
        },
      },
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
            // assign({ queue: (ctx) => [] }),
          ],
          on: {
            SEND: {
              actions: forwardTo("socket"),
            },
            RECEIVE: {
              actions: sendParent((ctx, e) => e.event),
            },
          },
        },
      },
      on: {
        SOCKET_CLOSED: "disconnected",
      },
    },
  },
});
