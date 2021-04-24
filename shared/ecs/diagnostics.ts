import { Archetype } from "./world.ts";
import { ComponentId } from "./component.ts";

const edgeLabel = (edge?: ComponentId) => (edge != null ? "[label=" + edge.description + "]" : "");

export function exportArchetypeGraph(archetypeRoot: Archetype, components: Iterable<ComponentId>): string {
  const componentNames = getComponentNames(components);

  const archetypeLabel = (a: Archetype) =>
    a.id.description != "" ? `"[${a.id.description?.split("|").join(", ")}]"` : "Empty";

  const edges: string[] = [];

  traverseArchtypeGraph(archetypeRoot, (a, b, e) => {
    edges.push(`  ${archetypeLabel(a)} -> ${archetypeLabel(b)} ${edgeLabel(e)};`);
  });

  return `
      strict digraph archetypes {
        // overlap = false;
        // viewport = "100,100"; 

        graph[concentrate=true]
        node [shape=box margin=0.1 fontsize=8 width=0.1 height=0.1]
        edge [fontsize=8]

        ${edges.join("\n")}
      }
    `;
}

function traverseArchtypeGraph(node: Archetype, fn: (a: Archetype, b: Archetype, c?: ComponentId) => void) {
  for (const [component, edge] of node.edges) {
    if (edge.remove != null) {
      fn(node, edge.remove);
      // traverseGraph(e.remove, fn);
    }
    if (edge.add != null) {
      fn(node, edge.add, component);
      traverseArchtypeGraph(edge.add, fn);
    }
  }
}

function getComponentNames(components: Iterable<ComponentId>): Map<ComponentId, string> {
  const componentNames: Map<ComponentId, string> = new Map();
  let counter = 0;

  for (const id of components) {
    const name = id.description || `<unnamed-${String(counter++).padStart(2, "0")}>`;
    if (mapHasValue(componentNames, name)) {
      console.warn(`duplicate component name ${name}`);
    }
    componentNames.set(id, name);
  }
  return componentNames;
}

function mapHasValue<T>(map: Map<any, T>, value: T): boolean {
  for (const v of map.values()) {
    if (v === value) {
      return true;
    }
  }
  return false;
}
