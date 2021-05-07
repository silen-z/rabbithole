import { system, component, resource } from "../shared/ecs.ts";
import { QuadTree } from "../shared/quad-tree.ts";
import { Sprite, SpriteRenderPass } from "./rendering/sprites.ts";
import { TerrainRenderPass } from "./rendering/terrain.ts";

export interface Position {
  x: number;
  y: number;
}

export const Position = component<Position>({ name: "Position" });
export const Terrain = component<QuadTree<boolean>>({ name: "Terrain" });

export class WebGLRenderer {
  gl: WebGLRenderingContext;
  spriteRenderPass: SpriteRenderPass;
  terrainRenderPass: TerrainRenderPass;

  constructor(private canvas: HTMLCanvasElement) {
    this.gl = canvas.getContext("webgl")!;
    this.gl.clearColor(1.0, 1.0, 1.0, 1.0);
    this.spriteRenderPass = new SpriteRenderPass(this.gl);
    this.terrainRenderPass = new TerrainRenderPass(this.gl);

    this.resizeToParent();
    window.addEventListener("resize", this.resizeToParent.bind(this));
  }

  resizeToParent() {
    this.canvas.width = this.canvas.parentElement!.clientWidth;
    this.canvas.height = this.canvas.parentElement!.clientHeight;
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  clear() {
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
  }
}

export const Renderer = resource<WebGLRenderer>();

export const RenderTerrain = system()
  .res(Renderer)
  .query(Terrain)
  .fn((_, renderer, terrain) => {
    renderer.clear();
    renderer.terrainRenderPass.use();
    for (const qt of terrain) {
      renderer.terrainRenderPass.draw(qt);
    }
  });

export const RenderingSystem = system()
  .res(Renderer)
  .query(Sprite, Position)
  .fn((_, renderer, sprites) => {
    renderer.spriteRenderPass.use();
    for (const [sprite, position] of sprites) {
      renderer.spriteRenderPass.draw(sprite, position);
    }
  });

export * from "./rendering/sprites.ts";
