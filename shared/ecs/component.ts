export type ComponentId = symbol;

export interface ComponentToInsert {
  id: ComponentId;
  data: unknown;
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
export function component<T>(name?: string): ComponentDefinition<T> {
  const id = Symbol(name || "<unnamed>") as ComponentId;
  const creator = (data: T) => ({ id, data });

  return Object.assign(creator, { id, queryType: "component" as const });
}

/**
 * returned when declaring component with {@link component} function
 * acts both as constructor for components and a query filter
 *
 * @category Query filters
 */
export type ComponentDefinition<T> = {
  id: ComponentId;
  queryType: "component";
  (data: T): ComponentToInsert;
};
