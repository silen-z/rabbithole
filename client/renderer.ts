import { system, component, resource } from "../shared/ecs.ts";
import { QuadTree } from "../shared/quad-tree.ts";

export const Sprite = component<{ src: CanvasImageSource }>("Sprite");
export const Position = component<{ x: number; y: number }>("Position");
export const Terrain = component<QuadTree<boolean>>("Terrain");

export class CanvasRenderer {
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

export const Renderer = resource<CanvasRenderer>();

export const RenderingSystem = system()
  .res(Renderer)
  .query(Sprite, Position)
  .fn((_, renderer, sprites) => {
    renderer.clear();
    const ctx = renderer.context;

    for (const [sprite, position] of sprites) {
      ctx.drawImage(sprite.src, position.x, position.y);
    }
  });

export const RenderTerrain = system()
  .res(Renderer)
  .query(Terrain)
  .fn((_, renderer, terrain) => {
    const ctx = renderer.context;

    for (const qt of terrain) {
      qt.draw((r, visible) => {
        if (visible) {
          ctx.strokeRect(r.x, r.y, r.w, r.h);
        }
      });
    }
  });
