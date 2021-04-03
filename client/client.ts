import { World } from "ecsy";
import * as PIXI from "pixi.js";
import { Machine, interpret, assign, State, send } from "xstate";
import { TickScheduler } from "../shared/tickscheduler";
import { Connection } from "./connection";
import { RenderingSystem, Sprite } from "./rendering-system";
import { UiControl } from "./ui";
import { Identify } from "../shared/packets";

class Client {
  world = new World();
  tickScheduler = new TickScheduler();
  service = interpret(ClientStateMachine, {
    clock: this.tickScheduler,
  });
  changedState?: ClientState;

  constructor(private renderer: PIXI.Application, private ui: UiControl) {
    this.service.onTransition((state) => {
      this.ui.rerender(state, this.service.send);
    });

    this.world.registerComponent(Sprite);
    this.world.registerSystem(RenderingSystem, { stage: this.renderer.stage });
  }

  start() {
    this.service.start();

    PIXI.Loader.shared.add("sprites/spaceship.png").load(() => {
      let handle = new PIXI.Sprite(PIXI.Loader.shared.resources["sprites/spaceship.png"].texture);
      this.world.createEntity("test-object").addComponent(Sprite, { handle });
    });

    let lastFrame = performance.now();

    const loop = (timestamp: number) => {
      const elapsed = timestamp - lastFrame;
      lastFrame = timestamp;
      const delta = elapsed / 1000;

      this.tickScheduler.tick(elapsed);
      this.world.execute(delta, timestamp);
      this.renderer.render();

      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
  }
}

interface ClientStateContext {
  identityRejectReason?: string;
  socketQueue?: ClientEvent[];
  connRef?: any;
}

export type ClientEvent =
  | { type: "IDENTIFY"; nickname: string }
  | { type: "HELLO"; serverState: string[] }
  | { type: "IDENTITY_CONFIRM" }
  | { type: "IDENTITY_REJECT"; reason: string }
  | { type: "SOCKET_READY" }
  | { type: "OPEN_CONNECTION" };

const ClientStateMachine = Machine<ClientStateContext, ClientEvent>({
  strict: true,
  initial: "unidentified",
  context: {},
  invoke: {
    id: "connection",
    src: Connection,
  },
  states: {
    unidentified: {
      initial: "selecting_name",
      states: {
        selecting_name: {
          on: {
            IDENTIFY: {
              target: "waiting_for_confirm",
              actions: [
                send({ type: "CONNECT", address: "ws://localhost:8000/game" }, { to: "connection" }),
                send(
                  (ctx, e) => ({
                    type: "SEND",
                    packet: Identify({ nickname: e.nickname }),
                  }),
                  { to: "connection" }
                ),
              ],
            },
          },
        },
        waiting_for_confirm: {
          entry: [assign({ identityRejectReason: (ctx) => null })],
          on: {
            IDENTITY_CONFIRM: "identified",
            IDENTITY_REJECT: {
              target: "selecting_name",
              actions: assign({
                identityRejectReason: (ctx, e) => e.reason,
              }),
            },
          },
          after: {
            // timeout
            5000: {
              target: "selecting_name",
              actions: assign({
                identityRejectReason: (ctx, e) => "timed out",
              }),
            },
          },
        },
        identified: {
          type: "final",
        },
      },
      onDone: "idle",
    },
    idle: {},
  },
});

export type ClientState = State<ClientStateContext, ClientEvent>;

let renderer = new PIXI.Application({
  resizeTo: document.body,
  autoStart: false,
  backgroundColor: 0x001418,
});
document.body.append(renderer.view);

let ui = new UiControl(document.getElementById("ui"));
let client = new Client(renderer, ui);

PIXI.Ticker.shared.stop();
client.start();
