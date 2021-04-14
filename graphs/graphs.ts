import { World, component } from "../shared/ecs.ts";
import { plotWorld, runPlots } from "./lib.js";

plotWorld("3components", () => {
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

  return world;
});

await runPlots();
