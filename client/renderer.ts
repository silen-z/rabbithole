import { system, component } from "../shared/ecs.ts";
import { QuadTree } from "../shared/quad-tree.ts";

export const Sprite = component<{ handle: CanvasImageSource }>("Sprite");
export const Position = component<{ x: number; y: number }>("Position");
export const Terrain = component<QuadTree<boolean>>("Terrain");

interface RenderResources {
  renderer: Renderer;
}

export const RenderingSystem = system<RenderResources>()
  .query(Sprite, Position)
  .fn(function (world, sprites) {
    world.resources.renderer.clear();

    const ctx = world.resources.renderer.context;

    for (const [sprite, position] of sprites) {
      ctx.drawImage(sprite.handle, position.x, position.y);
    }
  });

export const RenderTerrain = system<RenderResources>()
  .query(Terrain)
  .fn((world, terrain) => {
    const ctx = world.resources.renderer.context;

    for (const qt of terrain) {
      qt.draw((r, visible) => {
        if (visible) {
          ctx.strokeRect(r.x, r.y, r.w, r.h);
        }
      });
    }
  });

export class Renderer {
  context: CanvasRenderingContext2D;

  constructor(private canvas: HTMLCanvasElement) {
    this.context = canvas.getContext("2d")!;

    this.resizeToParent();
    window.addEventListener("resize", this.resizeToParent.bind(this));
  }

  resizeToParent() {
    this.canvas.width = this.canvas.parentElement!.clientWidth;
    this.canvas.height = this.canvas.parentElement!.clientHeight;
  }

  clear() {
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}
