import { Machine, DoneEventObject } from "xstate";
import { system, component, entity, has } from "../shared/ecs.ts";
import { Sprite, Position, Renderer, Terrain } from "./renderer.ts";
import { Assets } from "./assets.ts";
import { range } from "../shared/utils.ts";
import { enableSystems, disableSystems, runSystemOnce, EcsContext } from "../shared/state-systems.ts";
import { QuadTree } from "../shared/quad-tree.ts";

const Ship = component<number>("Ship");
const Direction = component<{ val: number }>("Direction");
const CleanupAfterLogin = component<void>("CleanupAfterLogin");

interface Resources {
  renderer: Renderer;
  delta: number;
  assets: Assets;
}

export const InitJoinScreen = system<Resources>().fn((world) => {
  const spaceship = world.resources.assets.get("spaceship.png")!;

  world.spawn(Terrain(new QuadTree(0, 0, 1920, 1080, 10, true)), CleanupAfterLogin());

  for (const i of range(5)) {
    world.spawn(
      Ship(10),
      Sprite({ handle: spaceship }),
      Position({ x: 100 * i, y: 100 * i }),
      Direction({ val: 5 }),
      CleanupAfterLogin()
    );
  }
});

export const MoveShips = system<Resources>()
  .query(has(Ship), Position, Direction)
  .fn((world, ships) => {
    for (const [pos, dir] of ships) {
      const { delta } = world.resources;

      pos.x = pos.x + 50 * delta;
      pos.y = pos.y + 50 * delta;
    }
  });

export const ShipModifyTerrain = system()
  .query(Ship, Position)
  .query(Terrain)
  .fn((_, ships, terrain) => {
    for (const [ship, pos] of ships) {
      for (const t of terrain) {
        t.updateWithCircle({ x: pos.x, y: pos.y, r: ship }, false);
      }
    }
  });

export const CleanupJoinScreen = system<Resources>()
  .query(entity, has(CleanupAfterLogin))
  .fn((world, entitiesToCleanup) => {
    // TODO can't delete entities while iterating over them with a query
    const toRemove = Array.from(entitiesToCleanup);

    for (const entity of toRemove) {
      world.despawn(entity);
    }
  });

export const JoinScreen = Machine<EcsContext, DoneEventObject>({
  initial: "loading_assets",
  states: {
    loading_assets: {
      invoke: {
        src: (ctx) => ctx.world.resources.assets.load("spaceship.png"),
        onDone: "assets_loaded",
      },
    },
    assets_loaded: {
      entry: [runSystemOnce(InitJoinScreen), enableSystems(MoveShips, ShipModifyTerrain)],
      exit: [disableSystems(MoveShips, ShipModifyTerrain)],
    },
  },
  exit: runSystemOnce(CleanupJoinScreen),
});
