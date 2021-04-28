import { World, ResourceDefinition } from "./world.ts";
import { QueryFilter, QueryFromFilters } from "./query.ts";

export interface System<PS extends unknown[] = any> {
  id: symbol;
  fn: (world: World, ...params: PS) => void;
  params: SystemParam[];
  startEnabled: boolean;
}

interface QueryDefinition<CS extends QueryFilter[] = QueryFilter[]> {
  type: "query";
  filters: CS;
}

export class SystemBuilder<PS extends SystemParam[] = []> {
  private params: SystemParam[] = [];

  res<R extends ResourceDefinition<any>[]>(...resources: R): SystemBuilder<[...PS, ...R]> {
    this.params.push(...resources);
    return this as any;
  }

  query<F1 extends QueryFilter, FS extends QueryFilter[]>(
    filter: F1,
    ...filters: FS
  ): SystemBuilder<[...PS, QueryDefinition<[F1, ...FS]>]> {
    this.params.push({ type: "query", filters: [filter, ...filters] });
    return this as any;
  }

  fn(systemFn: (this: World, world: World, ...params: ToSystemParams<PS>) => void): System<ToSystemParams<PS>> {
    return {
      id: Symbol(),
      fn: systemFn,
      params: this.params,
      startEnabled: true,
    };
  }
}

export function system(): SystemBuilder {
  return new SystemBuilder();
}

export type SystemParam = QueryDefinition | ResourceDefinition<any>;

type ToSystemParams<QS extends SystemParam[]> = {
  [Q in keyof QS]: QS[Q] extends QueryDefinition<infer QF>
    ? QueryFromFilters<QF>
    : QS[Q] extends ResourceDefinition<infer R>
    ? R
    : never;
};

// type Command = {type: "insert", entity: Entity, components: Components }

// class Commands {
//   private queue = []

// }
