import { Archetype, ArchetypeId } from "./world.ts";
import { ComponentDefinition, ComponentId } from "./component.ts";

export type QueryFilter = { queryType: "entity" } | { queryType: "tag"; id: ComponentId } | ComponentDefinition<any>;

export class Query {
  constructor(private filters: QueryFilter[], private archetypes: Map<ArchetypeId, Archetype>) {}

  *[Symbol.iterator]() {
    const selectedArchetypes: Archetype[] = [];

    for (const a of this.archetypes.values()) {
      if (selectArchetype(a, this.filters)) {
        selectedArchetypes.push(a);
      }
    }

    // const archetypes = selectedArchetypes.length === 0 ? this.archetypes.values() : selectedArchetypes;

    for (const a of selectedArchetypes) {
      for (let i = 0; i < a.entities.length; i++) {
        const result = [];

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

            case "tag": {
              break;
            }
          }
        }

        yield result.length === 1 ? result[0] : result;
      }
    }
  }
}

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
