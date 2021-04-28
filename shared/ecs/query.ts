import { Archetype, Entity } from "./world.ts";
import { ComponentDefinition, ComponentId } from "./component.ts";

export class Query<R = unknown> implements Iterator<R> {
  private archetypes: Archetype[] = [];
  private resultFilters: QueryFilter[];

  private archtypeIndex = 0;
  private entityIndex = 0;
  private result: IteratorResult<R> = {
    done: true,
    value: undefined,
  };

  constructor(private filters: QueryFilter[], archetypes: Iterable<Archetype>) {
    this.resolveArchetypes(archetypes);

    this.resultFilters = this.filters.filter(isProducingFilter);

    if (this.resultFilters.length === 0) {
      console.warn("filters resulted in an empty query");
    }

    if (this.resultFilters.length > 1) {
      this.result.value = new Array(this.resultFilters.length);
    } else {
      this.updateResult = this.updateSingleResult;
    }
  }

  resolveArchetypes(archetypes: Iterable<Archetype>) {
    this.archetypes.length = 0;
    for (const a of archetypes) {
      if (isMatchingArchetype(a, this.filters)) {
        this.archetypes.push(a);
      }
    }
  }

  next(): IteratorResult<R> {
    if (this.archtypeIndex > this.archetypes.length - 1) {
      this.result.done = true;
      return this.result;
    }

    while (this.entityIndex > this.archetypes[this.archtypeIndex]!.entities.length - 1) {
      ++this.archtypeIndex

      if (this.archtypeIndex > this.archetypes.length - 1) {
        this.result.done = true;
        return this.result;
      }

      this.entityIndex = 0;
    }

    this.updateResult(this.archetypes[this.archtypeIndex]!);

    ++this.entityIndex;
    return this.result;
  }

  [Symbol.iterator](): this {
    this.result.done = false;
    this.archtypeIndex = 0;
    this.entityIndex = 0;
    return this;
  }

  updateResult(archetype: Archetype) {
    let current;
    for (const f in this.resultFilters) {
      current = this.resultFilters[f]!;
      switch (current.filter) {
        case "component":
          this.result.value[f] = archetype.get(current.id, this.entityIndex);
          break;

        case "entity":
          this.result.value[f] = archetype.entities[this.entityIndex];
          break;
      }
    }
  }

  updateSingleResult(archetype: Archetype) {
    const f = this.resultFilters[0]!;
    switch (f.filter) {
      case "component":
        this.result.value = archetype.get(f.id, this.entityIndex);
        break;

      case "entity":
        this.result.value = archetype.entities[this.entityIndex];
        break;
    }
  }
}

// Query filters

export type EntityFilter = { filter: "entity" };
/**
 * @category Query filters
 */
export const entity: EntityFilter = { filter: "entity" };

export type HasComponentFilter = { filter: "has_component"; id: ComponentId };
/**
 * @category Query filters
 */
export function has(component: ComponentDefinition<any>): HasComponentFilter {
  return { filter: "has_component", id: component.id };
}

export type QueryFilter = ComponentDefinition<any> | EntityFilter | HasComponentFilter;

// Utils

function isProducingFilter(f: QueryFilter) {
  return f.filter !== "has_component";
}

function isMatchingArchetype(archetype: Archetype, filters: QueryFilter[]) {
  for (const f of filters) {
    if (f.filter === "entity") {
      continue;
    }
    if (!archetype.type.has(f.id)) {
      return false;
    }
  }
  return true;
}

// Query params for systems

type MapFilters<QF extends QueryFilter[]> = QF extends [QueryFilter]
  ? QueryResult<QF[0]>
  : { [K in keyof QF]: QueryResult<QF[K]> };

type QueryResult<F> = F extends EntityFilter ? Entity : F extends ComponentDefinition<infer T> ? T : unknown;

type EmptyFilter = HasComponentFilter;

type OmitEmptyFilters<FS extends unknown[]> = FS extends [infer F, ...infer T]
  ? F extends EmptyFilter
    ? OmitEmptyFilters<T>
    : [F, ...OmitEmptyFilters<T>]
  : FS;

export type QueryFromFilters<QF extends QueryFilter[]> = Query<MapFilters<OmitEmptyFilters<QF>>>;
