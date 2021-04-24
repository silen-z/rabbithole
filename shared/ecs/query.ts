import { Archetype, ArchetypeId, Entity } from "./world.ts";
import { ComponentDefinition, ComponentId } from "./component.ts";

export class Query<R> {
  constructor(private filters: QueryFilter[], private archetypes: Map<ArchetypeId, Archetype>) {}

  *[Symbol.iterator](): Generator<R> {
    const selectedArchetypes: Archetype[] = [];

    const result = [];

    for (const a of this.archetypes.values()) {
      if (selectArchetype(a, this.filters)) {
        selectedArchetypes.push(a);
      }
    }

    // const archetypes = selectedArchetypes.length === 0 ? this.archetypes.values() : selectedArchetypes;

    for (const a of selectedArchetypes) {
      for (let i = 0; i < a.entities.length; i++) {
        result.length = 0;

        for (const f of this.filters) {
          switch (f.queryType) {
            case "component": {
              const data = a.get(f.id, i);

              result.push(data);
              break;
            }

            case "entity": {
              result.push(a.entities[i]);
              break;
            }

            case "has_component": {
              break;
            }
          }
        }

        if (result.length === 1) {
          yield result[0] as R;
        } else {
          yield result as any;
        }
      }
    }
  }
}

// Query filters

export type EntityFilter = { queryType: "entity" };
/**
 * @category Query filters
 */
export const entity: EntityFilter = { queryType: "entity" };

export type HasComponentFilter = { queryType: "has_component"; id: ComponentId };
/**
 * @category Query filters
 */
export function has(component: ComponentDefinition<any>): HasComponentFilter {
  return { queryType: "has_component", id: component.id };
}

export type QueryFilter = ComponentDefinition<any> | EntityFilter | HasComponentFilter;

// Query params for systems

export type QueryFromFilters<QF extends QueryFilter[]> = Query<MapFilters<OmitEmptyFilters<QF>>>;

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

// Utils

function selectArchetype(archetype: Archetype, filters: QueryFilter[]) {
  for (const f of filters) {
    if (f.queryType === "entity") {
      continue;
    }
    if (!archetype.type.has(f.id)) {
      return false;
    }
  }
  return true;
}
