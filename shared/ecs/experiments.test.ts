// type ComponentInit<Data, Args extends any[]> = (obj: Data, ...args: Args) => void;

// type InitArgs<C extends Component<any, any>> = C["pooled"]["init"] extends (obj: any, ...args: infer Args) => void
//   ? Args
//   : never;

// type Uninit<T> = {
//   [K in keyof T]: undefined;
// };

// interface Component<D, A extends any[]> {
//   id: symbol;
//   pooled: {
//     template: Uninit<D>;
//     init(obj: D, ...args: A): void;
//   };
//   (...args: A): symbol;
// }

// interface ComponentOptions<D, A extends any[]> {
//   name?: string;
//   pooled?: {
//     template: Uninit<D>;
//     init(obj: D, ...args: A): void;
//   };
// }

// function component<D, A extends any[]>(options: ComponentOptions<D, A>): Component<D, A> {

//   const definition = {
//     id: Symbol(options.name),
//     pooled: options.pooled!,
//   }

//   const construct = (...args: A) => {

//   };
//   return Object.assign(construct, );
// }

// type Position = { x: number; y: number };
// const Position = component({
//   name: "test",
//   pooled: {
//     template: { x: undefined, y: undefined },
//     init(obj: Position, x: number, y: number) {
//       obj.x = x;
//       obj.y = y;
//     },
//   },
// });

const TYPES = {
  u8: 8,
};
type Type = keyof typeof TYPES;

function component<T>(schema: Record<string, Type>): ComponentDef<T> {
  let offset = 0;
  const offsetMap: ComponentDef<any>["schema"] = {};
  for (const [prop, type] of Object.entries(schema)) {
    offsetMap[prop] = offset;
    offset += TYPES[type];
  }

  return {
    schema: offsetMap,
    size: offset,
  };
}

interface ComponentDef<T> {
  schema: Record<string, number>;
  size: number;
}

class ComponentStorage<T> {
  private data: ArrayBuffer;
  private view: DataView;
  private length = 0;
  private componentView = { __index: 0 };

  constructor(private component: ComponentDef<T>, size: number) {
    this.data = new ArrayBuffer(component.size * size);
    this.view = new DataView(this.data);

    const storage = this;
    for (const [prop, offset] of Object.entries(this.component.schema)) {
      Object.defineProperty(this.componentView, prop, {
        get() {
          return storage.view.getInt8(this.__index * storage.component.size + offset);
        },
      });
    }
  }

  insert(component: T) {
    console.log(this.component.schema, this.component.size);

    for (const [prop, propOffset] of Object.entries(this.component.schema)) {
      // @ts-ignore index by schema
      const value = component[prop];
      console.log("setting value at:", this.length * this.component.size + propOffset);
      this.view.setUint8(this.length * this.component.size + propOffset, value);
    }
    ++this.length;
  }

  *[Symbol.iterator](): Generator<T> {
    const view = new DataView(this.data);
    const current = { index: 0 };

    // const handle = new Proxy(current, {
    //   get: (current, prop) => {
    //     const offset = this.component.schema[prop as string];
    //     if (offset == null) {
    //       throw new Error("invalid property");
    //     }
    //     return view.getInt8(current.index * this.component.size + offset);
    //   },
    // });

    for (let i = 0; i < this.length; i++) {
      this.componentView.__index = i;
      yield this.componentView as any;
    }
  }
}

// Deno.test("simple", () => {
//   const Position = component<{ x: number; y: number }>({ x: "u8", y: "u8" });

//   const storage = new ComponentStorage(Position, 100);

//   storage.insert({ x: 10, y: 15 });

//   for (const c of storage) {
//   }
// });
