import { World } from "./world.ts";
import { QueryFilter, QueryFromFilters } from "./query.ts";

export interface System<R = any, P extends unknown[] = any> {
  id: symbol;
  fn: (world: Context<R>, ...queries: P) => void;
  queries: QueryDefinition[];
  startEnabled: boolean;
}

interface QueryDefinition<CS extends QueryFilter[] = QueryFilter[]> {
  filters: CS;
}

interface Context<R> extends World {
  resources: R;
}

export class SystemBuilder<R, QS extends QueryDefinition[] = []> {
  private queries: QueryDefinition[] = [];

  query<F1 extends QueryFilter, FS extends QueryFilter[]>(
    filter: F1,
    ...filters: FS
  ): SystemBuilder<R, [...QS, QueryDefinition<[F1, ...FS]>]> {
    this.queries.push({ filters: [filter, ...filters] });
    return this as any;
  }

  fn(systemFn: (world: Context<R>, ...queries: ToSystemParams<QS>) => void): System<R, ToSystemParams<QS>> {
    return {
      id: Symbol(),
      fn: systemFn,
      queries: this.queries,
      startEnabled: true,
    };
  }
}

export function system<R>(): SystemBuilder<R> {
  return new SystemBuilder();
}

type ToSystemParams<QS extends QueryDefinition[]> = {
  [Q in keyof QS]: QS[Q] extends QueryDefinition<infer QF> ? QueryFromFilters<QF> : unknown;
};
