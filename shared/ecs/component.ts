declare const ComponentTag: unique symbol;
export type ComponentId = symbol & { [ComponentTag]: true };

export interface ComponentDefinition<T> {
  id: ComponentId;
  queryType: "component";
  (data: T): ComponentToInsert<T>;
}

export type ComponentToInsert<T> = {
  id: ComponentId;
  data: T;
};

export function component<T>(name?: string): ComponentDefinition<T> {
  const id = Symbol(name || "<unnamed>") as ComponentId;
  const creator = (data: T) => ({ id, data });

  return Object.assign(creator, { id, queryType: "component" as const });
}
