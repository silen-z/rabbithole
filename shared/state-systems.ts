import { System, World } from "./ecs.ts";

export interface EcsContext<R> {
  world: World<R>;
}

export const run = <R>(system: System<R>) => (ctx: EcsContext<R>) => {
  ctx.world.enable(system);

  return () => ctx.world.disable(system);
};

export const runOnce = <R>(system: System<R>) => (ctx: EcsContext<R>) => {
  ctx.world.runOnce(system);
};

// export function runOnce<C extends EcsContext<R>, R>(system: System<R>) {
//   return (ctx: C) => ctx.world.runOnce(system);
// }
