import { swapRemove, findSingleDiff } from "../utils.ts";
import { System } from "./system.ts";
import { ComponentId, ComponentToInsert, ComponentDefinition } from "./component.ts";
import { Query } from "./query.ts";
import { exportArchetypeGraph } from "./diagnostics.ts";

export type Entity = number & { _opaque: "Entity" };

interface EntityMeta {
  type: ArchetypeId;
  index: number;
}

export type ArchetypeId = symbol & { _opaque: "ArchetypeId" };

interface RuntimeSystem {
  fn: (world: World, ...queries: Query<unknown>[]) => void;
  queries: Query<unknown>[];
  enabled: boolean;
}

/**
 * ECS world that contains entities and their components
 */
export class World {
  /**
   * resources object given to systems to store data and communicate with services outside the ECS
   * */
  resources: Record<string, any>;

  private lastEntity = 0;

  private components: Set<ComponentId> = new Set();

  private rootArchetype = new Archetype(new Set(), this.components);

  private systems: Map<symbol, RuntimeSystem> = new Map();

  private entities: Map<Entity, EntityMeta> = new Map();

  private archetypes: Map<ArchetypeId, Archetype> = new Map();

  /**
   * Creates empty ECS world
   * @param resources initial resources, defaults to empty object
   */
  constructor(resources = {}) {
    this.archetypes.set(this.rootArchetype.id, this.rootArchetype);
    this.resources = resources;
  }

  /**
   * executes all enabled systems
   */
  execute(): void {
    for (const system of this.systems.values()) {
      if (system.enabled) {
        system.fn(this, ...system.queries);
      }
    }
  }

  /**
   * registers system for this world, does nothing if system is already registered
   * @param system system to register
   */
  registerSystem(system: System): this {
    // TODO decide what to do when registering same system twice
    if (this.systems.has(system.id)) {
      return this;
    }
    this.systems.set(system.id, this.toRuntimeSystem(system));
    return this;
  }

  /**
   * runs system once, without registering it
   * @param system system to run
   */
  runOnce(system: System): void {
    const queries = system.queries.map((qd) => new Query(qd.filters, this.archetypes));
    system.fn(this, ...queries);
  }

  /**
   * enables system, registering it if needed
   * @param system system to enable
   */
  enable(system: System): void {
    const s = this.systems.get(system.id);
    if (s != null) {
      s.enabled = true;
    } else {
      const runtime = this.toRuntimeSystem(system);
      runtime.enabled = true;
      this.systems.set(system.id, runtime);
    }
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

  spawn(...components: ComponentToInsert[]): Entity {
    const entity = this.lastEntity++ as Entity;

    const archetype = this.findArchetype(this.rootArchetype, components);

    const index = archetype.entities.push(entity) - 1;
    for (const { id, data } of components) {
      archetype.set(id, index, data);
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

  insert(entity: Entity, ...components: { id: ComponentId; data: unknown }[]): void {
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

  addResources(resources: Record<string, any>): this {
    Object.assign(this.resources, resources);
    return this;
  }

  registerComponent<T>(definition: ComponentDefinition<T>): void {
    if (this.components.has(definition.id)) {
      throw Error(`component ${definition.id.description} is already registered`);
    }

    this.registerComponentId(definition.id);
  }

  diagnostics(): Diagnostics {
    return {
      registeredComponents: this.components,
      entityCount: this.entities.size,
      archetypeCount: this.archetypes.size,
      archetypeGraph: exportArchetypeGraph(this.rootArchetype, this.components),
    };
  }

  private toRuntimeSystem(system: System): RuntimeSystem {
    return {
      fn: system.fn,
      queries: system.queries.map((qd) => new Query(qd.filters, this.archetypes)),
      enabled: system.startEnabled,
    };
  }

  private findArchetype(start: Archetype, componentsToAdd: Iterable<ComponentToInsert>): Archetype {
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

    return newArchetype;
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

export interface Diagnostics {
  readonly registeredComponents: Set<ComponentId>;
  readonly entityCount: number;
  readonly archetypeCount: number;
  readonly archetypeGraph: string;
}
