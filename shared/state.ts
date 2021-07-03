type StateMachineDefinition<BaseContext> = {
  states: {};
};

interface StateMachine {}

function machine<BaseContext>(definition: StateMachineDefinition<BaseContext>): StateMachine {
  return null as any;
}

// EXAMPLE
type Context = {
  count: number;
  world?: string;
};

type LoadedContext = {
  world: string;
};

// const JoinScreen = machine<States>({
//   initial: State1,
//   states: {
//     on: "",
//     [State1]: {
//       on: State2,
//     },
//     [State2]: {},
//   },
// });

const JoinScreen = machine<Context>({
  states: {
    LOADING: {
      on: {
        LOADED: "LOADED"
      }
    },
    LOADED: {}
  },
});

// const joinScreen = JoinScreen.start(State1, { world: {}, value1: true });

// joinScreen.send(JoinEvent("kljhk"));

function runSystems(...s: string[]) {}

function action2() {}
