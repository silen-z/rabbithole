import { system } from "../shared/ecs.ts";

export class Renderer {
  context: CanvasRenderingContext2D;

  constructor(private canvas: HTMLCanvasElement) {
    this.context = canvas.getContext("2d")!;

    this.canvas.addEventListener("resize", (e) => console.log(e));
  }

  clear() {
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}

interface RenderResources {
  renderer: Renderer;
  time: {delta: number}
}

export const renderingSystem = system(({ renderer }: RenderResources) => {
  renderer.clear();

  const ctx = renderer.context;

  ctx.lineWidth = 10;

  // Wall
  ctx.strokeRect(75, 140, 150, 110);

  // Door
  ctx.fillRect(130, 190, 40, 60);

  // Roof
  ctx.beginPath();
  ctx.moveTo(50, 140);
  ctx.lineTo(150, 60);
  ctx.lineTo(250, 140);
  ctx.closePath();
  ctx.stroke();
});
