import { swapRemove, findSingleDiff, Assign } from "./utils.ts";

declare const EntityTag: unique symbol;
type Entity = number & { [EntityTag]: true };

declare const ComponentTag: unique symbol;
type ComponentId = symbol & { [ComponentTag]: true };

type ArchetypeId = symbol;

interface EntityMeta {
  type: ArchetypeId;
  index: number;
}

export class World<R> {
  private lastEntity = 0;
  private components: Set<ComponentId> = new Set();
  private emptyArchetype = new Archetype(new Set(), this.components);
  private systems: Map<symbol, System<R>> = new Map();
  private entities: Map<Entity, EntityMeta> = new Map();
  private archetypes: Map<ArchetypeId, Archetype> = new Map().set(this.emptyArchetype.id, this.emptyArchetype);

  resources: R = Object.create(null);

  registerSystem<SR extends R, Q extends QueryDefinition[]>(system: System<SR, Q>) {
    this.systems.set(system.id, system as any);
    return this;
  }

  execute(deltaTime: number) {
    for (const system of this.systems.values()) {
      if (system.enabled) {
        const queries = system.queries.map((qd) => this.query(...qd.filters));
        system.fn(this, ...queries);
      }
    }
  }

  spawn(...components: ComponentToInsert<unknown>[]): Entity {
    const entity = this.lastEntity++ as Entity;

    const archetype = this.findArchetype(this.emptyArchetype, components);

    const index = archetype.entities.push(entity) - 1;
    for (const { id, data } of components) {
      archetype.set(id, index, data);
    }

    this.entities.set(entity, { type: archetype.id, index });

    return entity;
  }

  insert(entity: Entity, ...components: { id: ComponentId; data: unknown }[]) {
    const meta = this.entities.get(entity);
    if (meta == null) {
      throw new Error(`entity ${entity} doesn't exist`);
    }
    const oldArchetype = this.archetypes.get(meta.type)!;

    // if current archetype has all inserted component just replace them
    if (components.every(({ id }) => oldArchetype.type.has(id))) {
      for (const { id, data } of components) {
        oldArchetype.set(id, meta.index, data);
      }
      return;
    }
    // otherwise the entity has to be moved to a new archetype

    // traverse the archetype graph, registering unknown components and creating archetypes when needed
    const newArchetype = this.findArchetype(oldArchetype, components);

    // move data from old archetype
    const { newIndex, movedEntity } = oldArchetype.moveTo(newArchetype, meta.index);
    // when entity gets swapped in old archetype, it needs its index updated
    if (movedEntity != null) {
      this.entities.get(movedEntity)!.index = meta.index;
    }

    // insert the data
    for (const { id, data } of components) {
      newArchetype.set(id, newIndex, data);
    }

    meta.type = newArchetype.id;
    meta.index = newIndex;
  }

  get<T>(entity: Entity, component: ComponentDefinition<T>): T | null {
    const meta = this.entities.get(entity);
    if (meta == null) {
      throw new Error(`entity ${entity} doesn't exist`);
    }
    const archetype = this.archetypes.get(meta.type)!;

    if (!archetype.type.has(component.id)) {
      return null;
    }

    return archetype.get(component.id, meta.index) as T | null;
  }

  // query<C1, C2>(f1: QueryFilter): Query<C1>;
  // query<C1, C2>(f1: QueryFilter, f2: ComponentDefinition<C2>): Query<[C1, C2]>;
  query(...filters: QueryFilter[]): Query<unknown[]>;
  *query(...filters: QueryFilter[]): Query<unknown | unknown[]> {
    const filteredArchetypes: Archetype[] = [];

    for (const a of this.archetypes.values()) {
      if (filters.every((f) => f.queryType !== "component" || a.type.has(f.id))) {
        filteredArchetypes.push(a);
      }
    }

    const selectedArchetypes: Iterable<Archetype> =
      filteredArchetypes.length === 0 ? this.archetypes.values() : filteredArchetypes;

    for (const archetype of selectedArchetypes) {
      for (let i = 0; i < archetype.entities.length; i++) {
        const result = [];

        for (const f of filters) {
          switch (f.queryType) {
            case "component": {
              const data = archetype.get(f.id, i);

              result.push(data);
              break;
            }

            case "entity": {
              result.push(archetype.entities[i]);
              break;
            }

            default: {
              throw Error("unimplemented");
            }
          }
        }

        yield result.length === 1 ? result[0] : result;
      }
    }
  }

  addResources<N>(resources: N): R extends unknown ? World<N> : World<Assign<R, N>> {
    Object.assign(this.resources, resources);
    return (this as unknown) as R extends unknown ? World<N> : World<Assign<R, N>>;
  }

  registerComponent<T>(definition: ComponentDefinition<T>) {
    if (this.components.has(definition.id)) {
      throw Error(`component ${definition.id.description} is already registered`);
    }

    this.registerComponentId(definition.id);
  }

  private findArchetype(start: Archetype, componentsToAdd: Iterable<ComponentToInsert<unknown>>): Archetype {
    let newArchetype = start;
    for (const { id } of componentsToAdd) {
      if (start.type.has(id)) {
        continue;
      }

      if (!newArchetype.edges.has(id)) {
        this.registerComponentId(id);
      }
      const edge = newArchetype.edges.get(id)!;

      newArchetype = edge.add != null ? edge.add : this.createArchetype(new Set(newArchetype.type).add(id));
    }

    return newArchetype;
  }

  private registerComponentId(id: ComponentId) {
    for (const archetype of this.archetypes.values()) {
      archetype.edges.set(id, { add: null, remove: null });
    }

    this.components.add(id);
  }

  private createArchetype(type: Set<ComponentId>): Archetype {
    const newArchetype = new Archetype(type, this.components);

    for (const [id, archetype] of this.archetypes) {
      const additionalComponent = findSingleDiff(type, archetype.type);
      if (additionalComponent != null) {
        archetype.edges.get(additionalComponent)!.add = newArchetype;
        newArchetype.edges.set(additionalComponent, { add: null, remove: archetype });
      }

      const missingComponent = findSingleDiff(archetype.type, type);
      if (missingComponent != null) {
        archetype.edges.get(missingComponent)!.remove = newArchetype;
        newArchetype.edges.set(missingComponent, { add: archetype, remove: null });
      }
    }

    this.archetypes.set(newArchetype.id, newArchetype);

    return newArchetype;
  }
}

interface Query<T> extends Generator<T> {}

interface Edge {
  add: Archetype | null;
  remove: Archetype | null;
}

class Archetype {
  id = Archetype.createId(this.type);
  entities: Entity[] = [];
  edges: Map<ComponentId, Edge> = new Map();
  components: Map<ComponentId, unknown[]> = new Map();

  constructor(public type: Set<ComponentId>, registeredComponents: Iterable<ComponentId>) {
    // init component storages
    for (const c of type) {
      this.components.set(c, []);
    }

    for (const c of registeredComponents) {
      this.edges.set(c, { add: null, remove: null });
    }
  }

  moveTo(newArchetype: Archetype, oldIndex: number): { newIndex: number; movedEntity?: Entity } {
    const entity = swapRemove(this.entities, oldIndex);
    const newIndex = newArchetype.entities.push(entity) - 1;

    // move data from old archetype
    for (const id of this.type) {
      const oldData = this.components.get(id)![oldIndex];
      newArchetype.set(id, newIndex, oldData);
      swapRemove(this.components.get(id)!, oldIndex);
    }

    return { newIndex, movedEntity: this.entities[oldIndex] };
  }

  get(component: ComponentId, index: number): unknown {
    return this.components.get(component)![index];
  }

  set(component: ComponentId, index: number, data: unknown) {
    this.components.get(component)![index] = data;
  }

  static createId(type: Set<ComponentId>) {
    const description = Array.from(type)
      .map((id) => id.description)
      .join("|");
    return Symbol(description);
  }
}

interface ComponentDefinition<T> {
  id: ComponentId;
  queryType: "component";
  (data: T): ComponentToInsert<T>;
}

type ComponentToInsert<T> = {
  id: ComponentId;
  data: T;
};

export function component<T>(name?: string): ComponentDefinition<T> {
  const id = Symbol(name || "<unnamed>") as ComponentId;
  const creator = (data: T) => ({ id, data });

  return Object.assign(creator, { id, queryType: "component" as const });
}

interface System<R, QS extends QueryDefinition[] = QueryDefinition[]> {
  id: symbol;
  fn: (world: World<R>, ...queries: ToSystemParams<QS>) => void;
  queries: QS;
  enabled: boolean;
}

type QueryFilter =
  | ComponentDefinition<any>
  | { queryType: "entity" }
  | { queryType: "added" }
  | { queryType: "removed" };

interface QueryDefinition<CS extends QueryFilter[] = QueryFilter[]> {
  filters: CS;
}

class SystemBuilderImpl<QS extends QueryDefinition[] = []> {
  private queries: QueryDefinition[] = [];

  query<F1 extends QueryFilter, FS extends QueryFilter[]>(filter: F1, ...filters: FS): SBWithQuery<QS, [F1, ...FS]> {
    this.queries.push({ filters: [filter, ...filters] });
    return this as any;
  }

  fn<R>(systemFn: (world: World<R>, ...queries: ToSystemParams<QS>) => void): System<R, QS> {
    return {
      id: Symbol(),
      fn: systemFn,
      queries: this.queries as QS,
      enabled: true,
    };
  }

  static fn<R>(systemFn: (world: World<R>, ...queries: ToSystemParams<[]>) => void) {
    const builder = new SystemBuilderImpl();
    return builder.fn(systemFn);
  }

  static query<F1 extends QueryFilter, FS extends QueryFilter[]>(filter: F1, ...filters: FS) {
    const builder = new SystemBuilderImpl();
    return builder.query(filter, ...filters);
  }
}

interface SystemBuilder<QS extends QueryDefinition[] = []> {
  query<F1 extends QueryFilter, FS extends QueryFilter[]>(filter: F1, ...filters: FS): SBWithQuery<QS, [F1, ...FS]>;
  fn<R>(systemFn: (world: World<R>, ...queries: ToSystemParams<QS>) => void): System<R, QS>;
}

export const system: SystemBuilder = SystemBuilderImpl;

type SBWithQuery<QS extends QueryDefinition[], Q extends QueryFilter[]> = QS extends []
  ? SystemBuilder<[QueryDefinition<Q>]>
  : SystemBuilder<[...QS, QueryDefinition<Q>]>;

const ExampleComponent = component<{ test: number }>("Example");

export const Entity: QueryFilter = { queryType: "entity" };

type ToSystemParams<QS extends QueryDefinition[]> = {
  [K in keyof QS]: QS[K] extends QueryDefinition<infer QF> ? IterableIterator<ToQueryParams<QF>> : unknown;
};

type ToQueryParams<QF extends QueryFilter[]> = QF extends [QueryFilter]
  ? ToQueryParam<QF[0]>
  : { [K in keyof QF]: ToQueryParam<QF[K]> };

type ToQueryParam<QP> = QP extends { queryType: "entity" }
  ? Entity
  : QP extends ComponentDefinition<infer T>
  ? T
  : unknown;

interface ExampleResources {
  time: number;
}

const ExampleSystem = system
  .query(Entity, ExampleComponent)
  .query(ExampleComponent)
  .fn((world: World<ExampleResources>, q1, q2) => {
    for (const [entity, example] of q1) {
      for (const example of q2) {
      }
    }
  });

const ExampleSystemWithoutQueries = system.fn((world) => {});

// seems to lose types along the way, but might be worth exploring further
// interface QueryDefinition2 {
//   filters: QueryFilter[];
// }

// type ToSystemParams2<QS extends QueryDefinition2[]> = {
//   [K in keyof QS]: QS[K] extends QueryDefinition2
//     ? IterableIterator<ToQueryParams<QS[K]["filters"]>>
//     : unknown;
// };