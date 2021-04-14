import { Machine, interpret, assign, State, send, SpawnedActorRef } from "xstate";
import { TickScheduler } from "../shared/tickscheduler.ts";
import { Connection, ConnectionEvent } from "./connection.ts";
import { World } from "../shared/ecs.ts";
import { Renderer, RenderingSystem } from "./renderer.ts";
import { Ui } from "./ui.tsx";
import { Identify } from "../shared/packets.ts";
import { Assets } from "./assets.ts";
import { JoinScreen } from "./join-screen.ts";

class Client {
  world = new World()
    .addResources({ delta: 0, renderer: this.renderer, assets: new Assets("/sprites/") })
    .registerSystem(RenderingSystem);

  tickScheduler = new TickScheduler();

  service = interpret(ClientStateMachine(this.world as World<unknown>, Connection("ws://localhost:8000/game")), {
    clock: this.tickScheduler,
  });

  constructor(private renderer: Renderer, private ui: Ui) {
    this.service.onTransition((state) => {
      this.ui.update(state, this.service.send);
    });
  }

  start() {
    this.service.start();

    let lastFrame = performance.now();

    const loop = (timestamp: number) => {
      const elapsed = timestamp - lastFrame;
      const delta = elapsed / 1000;

      this.tickScheduler.tick(elapsed);
      this.world.resources.delta = delta;
      this.world.execute();

      lastFrame = timestamp;
      window.requestAnimationFrame(loop);
    };

    window.requestAnimationFrame(loop);
  }
}

interface ClientStateContext {
  world: World<unknown>;
  identityRejectReason?: string;
  socketQueue?: ClientEvent[];
  connRef?: SpawnedActorRef<ConnectionEvent>;
}

export type ClientEvent =
  | { type: "IDENTIFY"; nickname: string }
  | { type: "HELLO"; serverState: string[] }
  | { type: "IDENTITY_CONFIRM" }
  | { type: "IDENTITY_REJECT"; reason: string }
  | { type: "SOCKET_READY" }
  | { type: "OPEN_CONNECTION" };

const ClientStateMachine = (world: World<unknown>, connection: Connection) =>
  Machine<ClientStateContext, ClientEvent>({
    strict: true,
    initial: "unidentified",
    context: { world },
    invoke: {
      id: "connection",
      src: connection,
    },
    states: {
      unidentified: {
        invoke: {
          id: "join-systems",
          src: JoinScreen,
          data: {
            world: (ctx: ClientStateContext) => ctx.world,
          },
        },
        initial: "selecting_name",
        states: {
          selecting_name: {
            on: {
              IDENTIFY: {
                target: "waiting_for_confirm",
                actions: [
                  send({ type: "CONNECT" }, { to: "connection" }),
                  send(
                    (_, e) => ({
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
            entry: assign({ identityRejectReason: (_) => undefined }),
            on: {
              IDENTITY_CONFIRM: "identified",
              IDENTITY_REJECT: {
                target: "selecting_name",
                actions: assign({
                  identityRejectReason: (_, e) => e.reason,
                }),
              },
            },
            after: {
              // timeout
              5000: {
                target: "selecting_name",
                actions: assign({
                  identityRejectReason: (_) => "timed out",
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

const renderer = new Renderer(window.document.getElementsByTagName("canvas")[0]!);
const ui = new Ui(window.document.getElementById("ui")!);
const client = new Client(renderer, ui);

client.start();
