import { System, World } from "./ecs.ts";

export interface EcsContext {
  world: World;
}

export const enableSystems = (...systems: System[]) => (ctx: EcsContext) => {
  for (const s of systems) {
    ctx.world.enable(s);
  }
};

export const disableSystems = (...systems: System[]) => (ctx: EcsContext) => {
  for (const s of systems) {
    ctx.world.disable(s);
  }
};

export const runSystemOnce = (system: System) => (ctx: EcsContext) => {
  ctx.world.runOnce(system);
};
