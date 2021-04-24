type ComponentInit<Data, Args extends any[]> = (obj: Data, ...args: Args) => void;

type InitArgs<C extends Component<any, any>> = C["pooled"]["init"] extends (obj: any, ...args: infer Args) => void
  ? Args
  : never;

type Uninit<T> = {
  [K in keyof T]: undefined;
};

interface Component<D, A extends any[]> {
  id: symbol;
  pooled: {
    template: Uninit<D>;
    init(obj: D, ...args: A): void;
  };
  (...args: A): symbol;
}

interface ComponentOptions<D, A extends any[]> {
  name?: string;
  pooled?: {
    template: Uninit<D>;
    init(obj: D, ...args: A): void;
  };
}

function component<D, A extends any[]>(options: ComponentOptions<D, A>): Component<D, A> {

  const definition = {
    id: Symbol(options.name),
    pooled: options.pooled!,
  }

  const construct = (...args: A) => {

  };
  return Object.assign(construct, );
}

type Position = { x: number; y: number };
const Position = component({
  name: "test",
  pooled: {
    template: { x: undefined, y: undefined },
    init(obj: Position, x: number, y: number) {
      obj.x = x;
      obj.y = y;
    },
  },
});

class World {
  insert<C extends Component<any, any>>(c: C, ...args: InitArgs<C>): void {
    const objectFromPool = {};
    c.init(objectFromPool, ...args);
  }
}

const world: World = {} as any;

world.insert(Position, 12, 23);
