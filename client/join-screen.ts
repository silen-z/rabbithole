import { Machine, DoneEventObject } from "xstate";
import { system, component, entity, tag } from "../shared/ecs.ts";
import { Sprite, Position } from "./renderer.ts";
import { Assets } from "./assets.ts";
import { range } from "../shared/utils.ts";
import { run, runOnce, EcsContext } from "../shared/state-systems.ts";

const JoinScreenObject = component<void>();

interface Resources {
  delta: number;
  assets: Assets;
}

export const InitJoinScreen = system.fn<Resources>((world) => {
  const spaceship = world.resources.assets.get("spaceship.png")!;
  for (const i of range(5)) {
    world.spawn(JoinScreenObject(), Sprite({ handle: spaceship }), Position({ x: 100 * i, y: 100 * i }));
  }
});

export const MoveShips = system.query(Position, tag(JoinScreenObject)).fn<Resources>((world, ships) => {
  for (const pos of ships) {
    pos.x = pos.x + 50 * world.resources.delta;
    pos.y = pos.y + 50 * world.resources.delta;
  }
});

export const CleanupJoinScreen = system
  .query(entity, tag(JoinScreenObject))
  .fn<Resources>((world, entitiesToCleanup) => {
    // TODO can't delete entities while iterating over them with a query
    const toRemove = Array.from(entitiesToCleanup);

    for (const entity of toRemove) {
      world.despawn(entity);
    }
  });

export const JoinScreen = Machine<EcsContext<Resources>, DoneEventObject>(
  {
    initial: "loading_assets",
    states: {
      loading_assets: {
        invoke: {
          src: (ctx) => ctx.world.resources.assets.load("spaceship.png"),
          onDone: "assets_loaded",
        },
      },
      assets_loaded: {
        entry: runOnce(InitJoinScreen),
        activities: "moveShips",
      },
    },
    exit: runOnce(CleanupJoinScreen),
  },
  {
    activities: {
      moveShips: run(MoveShips),
    },
  }
);
