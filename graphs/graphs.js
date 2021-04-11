const __dirname = new URL(".", import.meta.url).pathname;
import { World, component } from "../shared/ecs.ts";

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

const Position = component("Position");
const Velocity = component("Velocity");
const Third = component("Third");

const world = new World();

world.spawn(Velocity(1));
const e = world.spawn(Velocity(2));
world.spawn(Velocity(3), Position({ x: 81, y: 42 }));
world.spawn(Position({ x: 57, y: 22 }));
world.spawn(Third(true));
world.spawn(Third(true), Position({ x: 81, y: 42 }));

world.insert(e, Third(false));


world.spawn(Velocity(1), Third(true), Position({ x: 81, y: 42 }));

const cmd = Deno.run({
  cmd: ["dot", "-Tpng", "-Kcirco", "-ograph-debug/graph.png"],
  stdin: "piped",
});

const encoder = new TextEncoder();

await cmd.stdin.write(encoder.encode(printArchetypeGraph(world)));
cmd.stdin.close();
await cmd.status();
cmd.close();
