import { swapRemove } from "./utils.ts";

// trick to make a opaque type
// declare const EntityType: unique symbol;
// type Entity = number & { [EntityType]: true };
type Entity = number;
// const Entity = component<never>();

declare const ComponentTag: unique symbol;
type ComponentId = symbol & { [ComponentTag]: true };

interface ComponentDefinition<T> {
  id: ComponentId;
  (data: T): [ComponentId, T];
}

export function component<T = never>(name = "<unnamed>"): ComponentDefinition<T> {
  const id = Symbol(name) as ComponentId;
  const creator = (c: T) => [id, c] as [ComponentId, T];
  creator.id = id;
  return creator;
}

interface System<R> {
  id: symbol;
  fn: (resources: R) => void;
  enabled: boolean;
}

export function system<R>(fn: (resources: R) => void): System<R> {
  return {
    id: Symbol(),
    fn,
    enabled: true,
  };
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
  private emptyArchetype = Symbol("empty-archetype");
  private systems: Map<symbol, System<R>> = new Map();
  private entities: Map<Entity, EntityMeta> = new Map();
  private archetypes: Map<ArchetypeId, Archetype> = new Map().set(this.emptyArchetype, new Archetype(new Set()));
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

  // TODO generation and rollover?
  spawn() {
    const entity = this.lastEntity++ as Entity;

    const emptyArchetype = this.archetypes.get(this.emptyArchetype)!;

    const index = emptyArchetype.entities.push(entity) - 1;

    this.entities.set(entity, { type: this.emptyArchetype, index });
    return entity;
  }

  insert(entity: Entity, ...components: [ComponentId, unknown][]) {
    const meta = this.entities.get(entity);
    if (meta == null) {
      throw new Error(`entity ${entity} doesn't exist`);
    }
    const oldArchetype = this.archetypes.get(meta.type)!;

    // if current archetype has all inserted component just set them
    if (components.every(([id]) => oldArchetype.type.has(id))) {
      for (const [id, data] of components) {
        oldArchetype.set(id, meta.index, data);
      }
      return;
    }
    // otherwise the entity has to be moved to a new archetype

    // traverse the graph to the new archetype, registering component and creating archetypes if needed
    let newArchetype = oldArchetype;
    let newArchetypeId: ArchetypeId;
    for (const [id] of components) {
      if (oldArchetype.type.has(id)) {
        continue;
      }
      if (!newArchetype.edges.has(id)) {
        this.registerComponentId(id);
      }
      const edge = newArchetype.edges.get(id)!;

      newArchetypeId = edge.add || this.createArchetype(new Set(newArchetype.type).add(id));
      newArchetype = this.archetypes.get(newArchetypeId)!;
    }

    const { newIndex, movedEntity } = oldArchetype.moveTo(newArchetype, meta.index);
    if (movedEntity != null) {
      this.entities.get(movedEntity)!.index = meta.index;
    }

    for (const [id, data] of components) {
      newArchetype.set(id, newIndex, data);
    }

    meta.type = newArchetypeId!;
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

    return archetype.components.get(component.id)![meta.index] as T | null;
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

    console.log(archetypes)

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
    console.log(`registering ${id.description} component`);
    for (const archetype of this.archetypes.values()) {
      archetype.edges.set(id, { add: null, remove: null });
    }

    this.components.add(id);
  }

  private createArchetype(type: Set<ComponentId>): ArchetypeId {
    const newId = Symbol();
    const newArchetype = new Archetype(type);

    for (const [id, archetype] of this.archetypes) {
      const additionalComponent = findSingleDiff(type, archetype.type);
      if (additionalComponent != null) {
        archetype.edges.get(additionalComponent)!.add = newId;
        newArchetype.edges.set(additionalComponent, { add: null, remove: id });
      }

      const missingComponent = findSingleDiff(archetype.type, type);
      if (missingComponent != null) {
        archetype.edges.get(missingComponent)!.remove = newId;
        newArchetype.edges.set(missingComponent, { add: id, remove: null });
      }
    }

    this.archetypes.set(newId, newArchetype);

    return newId;
  }

  // private hasComponent(entity: Entity, component: ComponentId) {
  //   this.entities.get(entity)!.type.includes(component);
  // }
}

class Archetype {
  entities: Entity[] = [];
  edges: Map<ComponentId, Edge> = new Map();
  components: Map<ComponentId, unknown[]>;

  constructor(public type: Set<ComponentId>) {
    this.components = new Map();
    for (const c of type) {
      this.components.set(c, []);
    }
  }

  moveTo(newArchetype: Archetype, oldIndex: number): { newIndex: number; movedEntity?: number } {
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

// class EntityBuilder<R> {
//   constructor(private world: World<R>) {

//   }

//   addComponent() {

//   }
// }

// creating: [A, B, C]

// found subset [A,T] -> T

function findSingleDiff<T>(superset: Set<T>, subset: Set<T>): T | null {
  if (superset.size !== subset.size + 1) {
    return null;
  }

  const result = new Set(superset);
  for (const e of subset) {
    result.delete(e);
  }

  if (result.size === 1) {
    return [...result][0]!;
  }

  return null;
}

type Assign<P, N> = { [K in keyof (P & N)]: K extends keyof N ? N[K] : K extends keyof P ? P[K] : never };
// type MergeSingleResource<P, K extends string, V> = K extends keyof P ? { [N in K]: V } : P & { [N in K]: V };
