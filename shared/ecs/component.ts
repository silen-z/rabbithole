import { ObjectPool } from "../object-pool.ts";

export type ComponentId = symbol;

interface ComponentOptions<T> {
  name?: string;
  pool?: ObjectPool<T, any[]>;
}

/**
 * Defines a component type, its advised to specify type to get autocompletion
 * in queries and when constructing the component
 *
 * ```typescript
 * const Position = component<{x: number, y: number}>();
 * ```
 *
 * Later the component can be constructed like this:
 * ```typescript
 * world.insert(entity, Position({x: 15, y: 42}));
 * ```
 * @typeParam T type of component data
 * @param name name of the component for debugging purposes
 */
export function component<T>(
  options: ComponentOptions<T> = {}
): typeof options extends { pool: ObjectPool<T, infer A> } ? PooledComponentDefinition<T, A> : ComponentDefinition<T> {
  const id = Symbol(options.name || generateComponentName()) as ComponentId;

  if (options.pool != null) {
    const pool = options.pool;
    const creator = (...args: any[]) => Insertions.get(id, pool.get(...args), true);
    return Object.assign(creator, { id, filter: "component" as const });
  }

  const creator = (data: T) => Insertions.get(id, data, false);
  return Object.assign(creator, { id, filter: "component" as const });
}

/**
 * returned when declaring component with {@link component} function
 * acts both as constructor for components and a query filter
 *
 * @category Query filters
 */
export type ComponentDefinition<T> = {
  id: ComponentId;
  filter: "component";
  (data: T): Insertion;
};

export type PooledComponentDefinition<T, A extends any[]> = ComponentDefinition<T> & {
  (...args: A): Insertion;
};

export type Insertion = {
  id: ComponentId;
  data: unknown;
  pooled: boolean;
};

export const Insertions = new ObjectPool(
  () => ({ id: undefined, data: undefined, pooled: undefined }),
  (i: Insertion, id, data, pooled) => {
    i.id = id;
    i.data = data;
    id.pooled = pooled;
  }
);

const generateComponentName = (() => {
  let count = 0;
  return () => `<component-${String(count++).padStart(2, "0")}>`;
})();
