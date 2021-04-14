const PLOTS = [];

export function plotWorld(filename, fn) {
  PLOTS.push(async () => {
    const world = fn();

    const cmd = Deno.run({
      cmd: ["dot", "-Tpng", "-Kcirco", `-ographs/${filename}.png`],
      stdin: "piped",
    });

    const encoder = new TextEncoder();

    await cmd.stdin.write(encoder.encode(printArchetypeGraph(world)));
    cmd.stdin.close();
    await cmd.status();
  });
}

export async function runPlots() {
  await Promise.all(PLOTS.map((f) => f()));
}

function printArchetypeGraph(world) {
  const componentNames = new Set();

  for (const id of world.components) {
    if (componentNames.has(id.description)) {
      throw new Error(`when debugging archetypes graph all components need a unique name, duplicate ${id.description}`);
    }
    componentNames.add(id.description);
  }

  const name = (a) => (a.id.description != "" ? `"[${a.id.description?.split("|").join(", ")}]"` : "Empty");

  const edge = (edge) => (edge != null ? "[label=" + edge.description + "]" : "");

  const edges = [];

  traverseGraph(world.emptyArchetype, (a, b, e) => {
    edges.push(`  ${name(a)} -> ${name(b)} ${edge(e)};`);
  });

  return `
strict digraph archetypes {
  overlap = false;

  node [shape=box]

${edges.join("\n")}
}`;
}

function traverseGraph(node, fn) {
  for (const [component, edge] of node.edges) {
    if (edge.remove != null) {
      fn(node, edge.remove);
      // traverseGraph(e.remove, fn);
    }
    if (edge.add != null) {
      fn(node, edge.add, component);
      traverseGraph(edge.add, fn);
    }
  }
}
