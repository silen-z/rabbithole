import { World } from "ecsy";
import * as PIXI from "pixi.js";
import { Machine, interpret, assign, send, forwardTo } from "xstate";
import { TickScheduler } from "../shared/tickscheduler";
import { UiControl } from "./ui";

class Client {
  pixi: PIXI.Application;
  world = new World();
  conn!: WebSocket;
  tickScheduler = new TickScheduler();
  service = interpret(ClientStateMachine, { clock: this.tickScheduler });
  ui: UiControl;

  constructor(canvasContainer: HTMLElement, uiContainer: HTMLElement) {
    this.pixi = new PIXI.Application({ resizeTo: canvasContainer });
    this.pixi.renderer.backgroundColor = 0x9bccfa;
    canvasContainer.appendChild(this.pixi.view);

    this.ui = new UiControl(uiContainer, this.service.send);
    this.service.onTransition((state) => {
      this.ui.rerender(state);
    });
  }

  start() {
    this.service.start();

    let lastFrame = performance.now();
    const loop = (timestamp: number) => {
      const elapsed = timestamp - lastFrame;
      const delta = elapsed / 1000;

      this.tickScheduler.tick(elapsed);
      this.world.execute(delta, timestamp);

      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
  }
}

export type ClientEvent =
  | { type: "IDENTIFY"; nickname: string }
  | { type: "HELLO"; serverState: string[] };

const ClientStateMachine = Machine({
  initial: "picking_name",
  context: {},
  invoke: {
    id: "socket",
    src: () => (callback, onEvent) => {
      let socket = new WebSocket(`ws://localhost:8000/game`);
      socket.addEventListener("message", (event) => {
        let data = JSON.parse(event.data);
        console.log("RECEIVING: ", data);
        callback(data);
      });

      onEvent((message) => {
        console.log("SENDING: ", message);
        socket.send(JSON.stringify(message));
      });

      return () => socket.close();
    },
  },

  states: {
    picking_name: {
      on: {
        IDENTIFY: {
          // target: "connecting",
          actions: forwardTo("socket")
        },
      },
    },
    connecting: {
      on: {
        HELLO: [
          {
            target: "lobby",
            cond: (_, e) => e.serverState.includes("lobby"),
          },
        ],
      },
    },
    lobby: {
      entry: () => {
        console.log("entering lobby");
      },
    },
  },
});

export type ClientState = ReturnType<typeof ClientStateMachine.transition>;

let client = new Client(document.body, document.getElementById("ui"));
client.start();
