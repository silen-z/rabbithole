import { swapRemove, findSingleDiff, Assign } from "../utils.ts";
import { System } from "./system.ts";
import { ComponentId, ComponentToInsert, ComponentDefinition } from "./component.ts";
import { Query } from "./query.ts";

declare const EntityTag: unique symbol;
export type Entity = number & { [EntityTag]: true };

interface EntityMeta {
  type: ArchetypeId;
  index: number;
}

export type ArchetypeId = symbol;

export class World<R> {
  private lastEntity = 0;
  private components: Set<ComponentId> = new Set();
  private emptyArchetype = new Archetype(new Set(), this.components);
  private systems: Map<symbol, System<R>> = new Map();
  private entities: Map<Entity, EntityMeta> = new Map();
  private archetypes: Map<ArchetypeId, Archetype> = new Map().set(this.emptyArchetype.id, this.emptyArchetype);

  private runOnceSystems: Set<System<R>> = new Set();

  resources: R = Object.create(null);

  registerSystem(system: System<R>) {
    this.systems.set(system.id, system);
    return this;
  }

  runOnce(system: System<R>) {
    if (this.systems.has(system.id)) {
      throw new Error("this system is already registered");
    }
    this.runOnceSystems.add(system);
    return this;
  }

  enable(system: System<R>) {
    const s = this.systems.get(system.id);
    if (s == null) {
      this.systems.set(system.id, system);
    }
    system.enabled = true;
  }

  disable(system: System<R>) {
    const s = this.systems.get(system.id);
    if (s == null) {
      throw new Error("this system is not registered");
    }
    s.enabled = false;
  }

  execute() {
    for (const system of this.runOnceSystems) {
      const queries = system.queries.map((qd) => new Query(qd.filters, this.archetypes));
      system.fn(this, ...queries);
    }

    for (const system of this.systems.values()) {
      if (system.enabled) {
        const queries = system.queries.map((qd) => new Query(qd.filters, this.archetypes));
        system.fn(this, ...queries);
      }
    }
    this.runOnceSystems.clear();
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

  despawn(entity: Entity) {
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

interface Edge {
  add: Archetype | null;
  remove: Archetype | null;
}

export class Archetype {
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
