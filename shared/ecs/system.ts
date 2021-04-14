import { ComponentId, ComponentDefinition } from "./component.ts";
import { World, Entity } from "./world.ts";
import { Query } from "./query.ts";

export type QueryFilter = { queryType: "entity" } | { queryType: "tag"; id: ComponentId } | ComponentDefinition<any>;

export const entity = { queryType: "entity" as const };

export function tag<C>(component: ComponentDefinition<C>) {
  return { queryType: "tag" as const, id: component.id };
}

export interface System<R> {
  id: symbol;
  fn: (world: World<R>, ...queries: Query[]) => void;
  queries: QueryDefinition[];
  enabled: boolean;
}

interface QueryDefinition<CS extends QueryFilter[] = QueryFilter[]> {
  filters: CS;
}

class SystemBuilder<QS extends QueryDefinition[] = []> {
  private queries: QueryDefinition[] = [];

  query<F1 extends QueryFilter, FS extends QueryFilter[]>(filter: F1, ...filters: FS): SBWithQuery<QS, [F1, ...FS]> {
    this.queries.push({ filters: [filter, ...filters] });
    return this as any;
  }

  fn<R>(systemFn: (world: World<R>, ...queries: ToSystemParams<QS>) => void): System<R> {
    return {
      id: Symbol(),
      fn: systemFn as any,
      queries: this.queries as QS,
      enabled: true,
    };
  }

  static fn<R>(systemFn: (world: World<R>, ...queries: ToSystemParams<[]>) => void) {
    const builder = new SystemBuilder();
    return builder.fn(systemFn);
  }

  static query<F1 extends QueryFilter, FS extends QueryFilter[]>(filter: F1, ...filters: FS) {
    const builder = new SystemBuilder();
    return builder.query(filter, ...filters);
  }
}

interface SystemBuilder<QS extends QueryDefinition[] = []> {
  query<F1 extends QueryFilter, FS extends QueryFilter[]>(filter: F1, ...filters: FS): SBWithQuery<QS, [F1, ...FS]>;
  fn<R>(systemFn: (world: World<R>, ...queries: ToSystemParams<QS>) => void): System<R>;
}

type SBWithQuery<QS extends QueryDefinition[], Q extends QueryFilter[]> = QS extends []
  ? SystemBuilder<[QueryDefinition<Q>]>
  : SystemBuilder<[...QS, QueryDefinition<Q>]>;

type ToSystemParams<QS extends QueryDefinition[]> = {
  [K in keyof QS]: QS[K] extends QueryDefinition<infer QF> ? Iterable<ToQueryParams<FilterTags<QF>>> : unknown;
};

type ToQueryParams<QF extends QueryFilter[]> = QF extends [QueryFilter]
  ? ToQueryParam<QF[0]>
  : { [K in keyof QF]: ToQueryParam<QF[K]> };

type FilterTags<T extends unknown[]> = T extends []
  ? []
  : T extends [infer H, ...infer R]
  ? H extends { queryType: "tag" }
    ? FilterTags<R>
    : [H, ...FilterTags<R>]
  : T;

type ToQueryParam<QP> = QP extends { queryType: "entity" }
  ? Entity
  : QP extends ComponentDefinition<infer T>
  ? T
  : unknown;

// const ExampleComponent = component<{ test: number }>("Example");

// interface ExampleResources {
//   time: number;
// }

// const ExampleSystem = system
//   .query(Entity, tag(ExampleComponent))
//   .query(ExampleComponent)
//   .fn<ExampleResources>((w, q1, q2) => {
//     for (const entity of q1) {
//       for (const example of q2) {
//         // example.test;
//       }
//     }
//   });

export { SystemBuilder as system };
