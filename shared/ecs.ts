import { swapRemove, findSingleDiff } from "./utils.ts";

declare const EntityTag: unique symbol;
type Entity = number & { [EntityTag]: true };

declare const ComponentTag: unique symbol;
type ComponentId = symbol & { [ComponentTag]: true };

interface ComponentDefinition<T> {
  id: ComponentId;
  (data: T): ComponentToInsert<T>;
}

type ComponentToInsert<T> = {
  id: ComponentId;
  data: T;
};

interface System<R> {
  id: symbol;
  fn: (resources: R) => void;
  enabled: boolean;
}

type ArchetypeId = symbol;

interface EntityMeta {
  type: ArchetypeId;
  index: number;
}

interface Edge {
  add: ArchetypeId | null;
  remove: ArchetypeId | null;
}

interface Query<T> {
  [Symbol.iterator]: () => IterableIterator<T>;
}

export class World<R> {
  private lastEntity = 0;
  private emptyArchetype = new Archetype(new Set());
  private systems: Map<symbol, System<R>> = new Map();
  private entities: Map<Entity, EntityMeta> = new Map();
  private archetypes: Map<ArchetypeId, Archetype> = new Map().set(this.emptyArchetype.id, this.emptyArchetype);
  private components: Set<ComponentId> = new Set();
  // private archetypeGraph

  resources: R = Object.create(null);

  registerSystem<SR extends R>(system: System<SR>) {
    this.systems.set(system.id, system as System<R>);
    return this;
  }

  execute(deltaTime: number, timestamp: number) {
    for (const system of this.systems.values()) {
      if (system.enabled) {
        system.fn(this.resources);
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

    this.entities.set(entity, { type: this.emptyArchetype.id, index });

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

  query<C1, C2>(c1: ComponentDefinition<C1>): Query<C1>;
  query<C1, C2>(c1: ComponentDefinition<C1>, c2: ComponentDefinition<C2>): Query<[C1, C2]>;
  query(...components: ComponentDefinition<unknown>[]): Query<unknown> {
    const archetypes: Archetype[] = [];

    for (const a of this.archetypes.values()) {
      if (components.every((c) => a.type.has(c.id))) {
        archetypes.push(a);
      }
    }

    return {
      *[Symbol.iterator]() {
        for (const archetype of archetypes) {
          for (let i = 0; i < archetype.entities.length; i++) {
            const result =
              components.length === 1
                ? archetype.get(components[0]!.id, i)
                : components.map((c) => archetype.get(c.id, i));

            yield result;
          }
        }
      },
    };
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

  private registerComponentId(id: ComponentId) {
    for (const archetype of this.archetypes.values()) {
      archetype.edges.set(id, { add: null, remove: null });
    }

    this.components.add(id);
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

      newArchetype =
        edge.add != null ? this.archetypes.get(edge.add)! : this.createArchetype(new Set(newArchetype.type).add(id));
    }

    return newArchetype;
  }

  private createArchetype(type: Set<ComponentId>): Archetype {
    const newArchetype = new Archetype(type);

    for (const [id, archetype] of this.archetypes) {
      const additionalComponent = findSingleDiff(type, archetype.type);
      if (additionalComponent != null) {
        archetype.edges.get(additionalComponent)!.add = newArchetype.id;
        newArchetype.edges.set(additionalComponent, { add: null, remove: id });
      }

      const missingComponent = findSingleDiff(archetype.type, type);
      if (missingComponent != null) {
        archetype.edges.get(missingComponent)!.remove = newArchetype.id;
        newArchetype.edges.set(missingComponent, { add: id, remove: null });
      }
    }

    this.archetypes.set(newArchetype.id, newArchetype);

    return newArchetype;
  }
}

class Archetype {
  id = Symbol();
  entities: Entity[] = [];
  edges: Map<ComponentId, Edge> = new Map();
  components: Map<ComponentId, unknown[]>;

  constructor(public type: Set<ComponentId>) {
    this.components = new Map();
    for (const c of type) {
      this.components.set(c, []);
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
}

export function component<T = void>(name = "<unnamed>"): ComponentDefinition<T> {
  const id = Symbol(name) as ComponentId;
  const creator = (data: T) => ({ id, data });
  creator.id = id;
  return creator;
}

export function system<R>(fn: (resources: R) => void): System<R> {
  return {
    id: Symbol(),
    fn,
    enabled: true,
  };
}

type Assign<P, N> = { [K in keyof (P & N)]: K extends keyof N ? N[K] : K extends keyof P ? P[K] : never };
// type MergeSingleResource<P, K extends string, V> = K extends keyof P ? { [N in K]: V } : P & { [N in K]: V };
