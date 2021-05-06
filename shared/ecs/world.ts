import { ComponentId, Insertion, Insertions, ComponentDefinition } from "./component.ts";
import { System, SystemParam } from "./system.ts";
import { Query } from "./query.ts";
import { exportArchetypeGraph } from "./diagnostics.ts";
import { swapRemove, findSingleDiff } from "../utils.ts";

export type Entity = number;

interface EntityMeta {
  type: ArchetypeId;
  index: number;
}

export type ArchetypeId = symbol;

interface CachedQuery {
  type: "cachedQuery";
  query: Query;
}

type RuntimeSystemParams = SystemParam | CachedQuery;

interface RuntimeSystem {
  fn: (world: World, ...queries: unknown[]) => void;
  params: RuntimeSystemParams[];
  enabled: boolean;
}

/**
 * ECS world that contains entities and their components
 */
export class World {
  /**
   * resources object given to systems to store data and communicate with services outside the ECS
   * */
  private resources: Map<symbol, unknown> = new Map();

  private lastEntity = 0;

  private components: Set<ComponentId> = new Set();

  private rootArchetype = new Archetype(new Set(), this.components);

  private systems: Map<symbol, RuntimeSystem> = new Map();

  private entities: Map<Entity, EntityMeta> = new Map();

  private archetypes: Map<ArchetypeId, Archetype> = new Map();

  private queriesNeedRefresh = false;

  /**
   * Creates empty ECS world
   */
  constructor() {
    this.archetypes.set(this.rootArchetype.id, this.rootArchetype);
  }

  /**
   * executes all enabled systems
   */
  execute(): void {
    for (const system of this.systems.values()) {
      if (system.enabled) {
        system.fn(this, ...this.resolveSystemParams(system.params, true, this.queriesNeedRefresh));
      }
    }
    this.queriesNeedRefresh = false;
  }

  /**
   * registers system for this world, does nothing if system is already registered
   * @param system system to register
   */
  withSystem(system: System): this {
    // TODO decide what to do when registering same system twice
    if (this.systems.has(system.id)) {
      return this;
    }
    this.registerSystem(system);
    return this;
  }

  /**
   * runs system once, without registering it
   * @param system system to run
   */
  runOnce(system: System): void {
    system.fn(this, ...this.resolveSystemParams(system.params));
  }

  /**
   * enables system, registering it if needed
   * @param system system to enable
   */
  enable(system: System): void {
    const s = this.systems.get(system.id) || this.registerSystem(system);
    s.enabled;
  }

  /**
   * disables system
   * @param system system to disable
   * @throws if systems is not registered in world
   */
  disable(system: System): void {
    const s = this.systems.get(system.id);
    if (s == null) {
      throw new Error("this system is not registered");
    }
    s.enabled = false;
  }

  private registerSystem(system: System): RuntimeSystem {
    const runtimeSystem = {
      fn: system.fn,
      params: system.params,
      enabled: system.startEnabled,
    };
    this.systems.set(system.id, runtimeSystem);
    return runtimeSystem;
  }

  spawn(...components: Insertion[]): Entity {
    const entity = this.lastEntity++ as Entity;

    const archetype = this.findArchetype(this.rootArchetype, components);

    const index = archetype.entities.push(entity) - 1;
    for (const c of components) {
      archetype.set(c.id, index, c.data);
      Insertions.recycle(c);
    }

    this.entities.set(entity, { type: archetype.id, index });

    return entity;
  }

  despawn(entity: Entity): void {
    const meta = this.entities.get(entity);
    if (meta == null) {
      throw new Error(`entity ${entity} doesn't exist`);
    }
    const archetype = this.archetypes.get(meta.type)!;

    swapRemove(archetype.entities, meta.index);
    for (const id of archetype.type) {
      swapRemove(archetype.components.get(id)!, meta.index);
    }

    const moved = archetype.entities[meta.index];
    if (moved != null) {
      this.entities.get(moved)!.index = meta.index;
    }

    this.entities.delete(entity);
  }

  insert(entity: Entity, ...components: Insertion[]): void {
    const meta = this.entities.get(entity);
    if (meta == null) {
      throw new Error(`entity ${entity} doesn't exist`);
    }
    const oldArchetype = this.archetypes.get(meta.type)!;

    // if current archetype has all inserted component just replace them
    if (components.every(({ id }) => oldArchetype.type.has(id))) {
      for (const c of components) {
        oldArchetype.set(c.id, meta.index, c.data);
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
    for (const c of components) {
      newArchetype.set(c.id, newIndex, c.data);
      Insertions.recycle(c);
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

  withResources(...resources: { id: symbol; res: any }[]): this {
    for (const { id, res } of resources) {
      this.resources.set(id, res);
    }
    return this;
  }

  res<T>(resource: ResourceDefinition<T>): T {
    const res = this.resources.get(resource.id);
    if (res == null) {
      throw new Error(`resource ${resource.id.description} is not registered in this world`);
    }
    return res as T;
  }

  withComponent<T>(definition: ComponentDefinition<T>): void {
    if (this.components.has(definition.id)) {
      throw Error(`component ${definition.id.description} is already registered`);
    }

    this.registerComponentId(definition.id);
  }

  private *resolveSystemParams(params: RuntimeSystemParams[], cacheQueries = false, refreshQueries = false) {
    let i = 0;
    for (const p of params) {
      switch (p.type) {
        case "cachedQuery":
          if (refreshQueries) {
            p.query.resolveArchetypes(this.archetypes.values());
          }
          yield p.query;
          break;
        case "query": {
          const query = new Query(p.filters, this.archetypes.values());
          if (cacheQueries) {
            params[i] = { type: "cachedQuery", query };
          }
          yield query;

          break;
        }
        case "resource":
          yield this.res(p);
      }
      ++i;
    }
  }

  private findArchetype(formerArchetype: Archetype, componentsToAdd: Iterable<Insertion>): Archetype {
    let newArchetype = formerArchetype;
    for (const { id } of componentsToAdd) {
      if (formerArchetype.type.has(id)) {
        continue;
      }

      if (!newArchetype.edges.has(id)) {
        this.registerComponentId(id);
      }
      const edge = newArchetype.edges.get(id)!;

      newArchetype = edge.add || this.createArchetype(new Set(newArchetype.type).add(id));
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

    for (const archetype of this.archetypes.values()) {
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
    this.queriesNeedRefresh = true;

    return newArchetype;
  }

  diagnostics(): Diagnostics {
    return {
      registeredComponents: this.components,
      entityCount: this.entities.size,
      archetypeCount: this.archetypes.size,
      archetypeGraph: exportArchetypeGraph(this.rootArchetype, this.components),
    };
  }
}

interface Edge {
  add: Archetype | null;
  remove: Archetype | null;
}

export class Archetype {
  id: ArchetypeId;
  entities: Entity[] = [];
  edges: Map<ComponentId, Edge> = new Map();
  components: Map<ComponentId, unknown[]> = new Map();

  constructor(public type: Set<ComponentId>, registeredComponents: Iterable<ComponentId>) {
    this.id = Archetype.createId(this.type);
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

  set(component: ComponentId, index: number, data: unknown): void {
    this.components.get(component)![index] = data;
  }

  static createId(type: Set<ComponentId>): ArchetypeId {
    const description = Array.from(type)
      .map((id) => id.description)
      .join("|");
    return Symbol(description) as ArchetypeId;
  }
}

export type ResourceDefinition<R> = {
  id: symbol;
  type: "resource";
  (res: R): { id: symbol; res: R };
};

export function resource<T>(name?: string): ResourceDefinition<T> {
  const id = Symbol(name || getResourceName());

  const creator = (res: T) => ({ id, res });

  return Object.assign(creator, { id, type: "resource" as const });
}

const getResourceName = (() => {
  let count = 0;
  return () => `<resource-${String(count++).padStart(2, "0")}>`;
})();

export interface Diagnostics {
  readonly registeredComponents: Set<ComponentId>;
  readonly entityCount: number;
  readonly archetypeCount: number;
  readonly archetypeGraph: string;
}
