import { system, component } from "../shared/ecs.ts";

export const Sprite = component<{ handle: CanvasImageSource }>();
export const Position = component<{ x: number; y: number }>();

interface Resources {
  renderer: Renderer;
}

export const RenderingSystem = system.query(Sprite, Position).fn<Resources>(function (world, sprites) {
  world.resources.renderer.clear();

  const ctx = world.resources.renderer.context;

  for (const [sprite, position] of sprites) {
    ctx.drawImage(sprite.handle, position.x, position.y);
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
