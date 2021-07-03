import { createMachine, DoneEventObject } from "xstate";
import { Renderer, Sprite, SpriteMaterial, Position, Terrain } from "./renderer.ts";
import { Assets } from "./assets.ts";
import { Time } from "../shared/time.ts";
import { Entity, system, component, entity, has, resource } from "../shared/ecs.ts";
import { enableSystems, disableSystems, runSystemOnce, EcsContext } from "../shared/state-systems.ts";
import { QuadTrees, updateCircle } from "../shared/quad-tree.ts";
import { range } from "../shared/utils.ts";
import { Rectangles } from "../shared/math.ts";

const Ship = component<number>();
const Direction = component<{ x: number; y: number }>({ name: "Direction" });
const CleanupAfterLogin = component<void>({ name: "CleanupAfterLogin" });

const ScreenTerrain = resource<Entity>();

export const InitJoinScreen = system()
  .res(Assets, Renderer)
  .fn((world, assets, renderer) => {
    const spaceship = assets.get("spaceship.png")!;
    const sprite = new SpriteMaterial(renderer.gl, spaceship);

    const inverted = assets.get("spaceship_i.png")!;
    const invertedSprite = new SpriteMaterial(renderer.gl, inverted);

    const terrain = world.spawn(
      Terrain(QuadTrees.get(Rectangles.get(50, 50, 850, 850), 10, true)),
      CleanupAfterLogin()
    );

    world.withResources(ScreenTerrain(terrain));

    for (const i of range(5)) {
      world.spawn(
        Ship(10),
        Sprite(i % 2 === 0 ? sprite : invertedSprite),
        Position({ x: i % 2 === 0 ? 200 : 800, y: 50 + 150 * i }),
        Direction({ x: i % 2 === 0 ? 50 : -50, y: Math.random() * (i % 2 === 0 ? -50 : 50) }),
        CleanupAfterLogin()
      );
    }
  });

export const MoveShips = system()
  .res(Time, ScreenTerrain)
  .query(has(Ship), Position, Direction)
  .fn((world, time, terrain, ships) => {
    const t = world.get(terrain, Terrain)!;
    for (const [pos, dir] of ships) {
      if (pos.x < t.area.x || pos.x > t.area.x + t.area.w) {
        pos.x = Math.min(Math.max(pos.x, t.area.x), t.area.x + t.area.w);
        dir.x = -dir.x;
      }

      if (pos.y < t.area.y || pos.y > t.area.y + t.area.h) {
        pos.y = Math.min(Math.max(pos.y, t.area.y), t.area.y + t.area.h);
        dir.y = -dir.y;
      }

      pos.x = pos.x + dir.x * time.delta;
      pos.y = pos.y + dir.y * time.delta;
    }
  });

export const ShipModifyTerrain = system()
  .query(Ship, Position)
  .query(Terrain)
  .fn((_, ships, terrain) => {
    for (const [ship, pos] of ships) {
      for (const t of terrain) {
        updateCircle(t, { x: pos.x, y: pos.y, r: ship }, false);
      }
    }
  });

export const CleanupJoinScreen = system()
  .query(entity, has(CleanupAfterLogin))
  .query(Terrain)
  .fn((world, entitiesToCleanup, terrain) => {
    for (const t of terrain) {
      console.log(JSON.parse(JSON.stringify(t)));
    }

    // TODO can't delete entities while iterating over them with a query
    const toRemove = Array.from(entitiesToCleanup);

    for (const entity of toRemove) {
      world.despawn(entity);
    }
  });

export const JoinScreen = createMachine<EcsContext, DoneEventObject>({
  initial: "loading_assets",
  states: {
    loading_assets: {
      // @ts-ignore
      invoke: {
        onError: (_: EcsContext, error: any) => {
          console.error(error);
        },
        src: (ctx) => {
          const assets = ctx.world.res(Assets);

          return Promise.all([assets.loadImage("spaceship_i.png"), assets.loadImage("spaceship.png")]);
        },
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
