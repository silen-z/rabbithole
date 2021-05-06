import { system, component, resource } from "../shared/ecs.ts";
import { QuadTree, traverseQuadTree } from "../shared/quad-tree.ts";
import { shader, program } from "./webgl.ts";
import BASIC_VERT from "./shaders/basic.vert";
import BASIC_FRAG from "./shaders/basic.frag";

export const Sprite = component<SpriteMaterial>({ name: "Sprite" });
export const Position = component<{ x: number; y: number }>({ name: "Position" });
export const Terrain = component<QuadTree<boolean>>({ name: "Terrain" });

export class WebGLRenderer {
  gl: WebGLRenderingContext;
  spriteRenderPass: SpriteRenderPass;

  constructor(private canvas: HTMLCanvasElement) {
    this.gl = canvas.getContext("webgl")!;
    this.gl.clearColor(1.0, 1.0, 1.0, 1.0);
    this.spriteRenderPass = new SpriteRenderPass(this.gl, BASIC_VERT, BASIC_FRAG);

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
    const ctx = renderer.gl;

    // for (const qt of terrain) {
    //   traverseQuadTree(qt, (r, visible) => {
    //     if (visible) {
    //       ctx.fillStyle = "gray";
    //       ctx.fillRect(r.x, r.y, r.w, r.h);
    //     }

    //     ctx.strokeStyle = visible ? "#333" : "#eee";
    //     ctx.strokeRect(r.x, r.y, r.w, r.h);
    //     // }
    //   });
    // }
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

class SpriteRenderPass {
  private positionBuffer: WebGLBuffer;
  private texCoordBuffer: WebGLBuffer;

  private fragmentShader: WebGLShader;
  private vertexShader: WebGLShader;

  private shaderProgram: WebGLProgram;

  private resolutionUniform: WebGLUniformLocation;

  private positionAttribute: number;
  private texCoordAttribute: number;

  constructor(private gl: WebGLRenderingContext, vertexSource: string, fragmentSource: string) {
    this.vertexShader = shader(gl, "vertex", vertexSource);
    this.fragmentShader = shader(gl, "fragment", fragmentSource);

    this.shaderProgram = program(gl, this.vertexShader, this.fragmentShader);

    this.resolutionUniform = gl.getUniformLocation(this.shaderProgram, "u_resolution")!;

    this.positionAttribute = gl.getAttribLocation(this.shaderProgram, "a_position");
    this.texCoordAttribute = gl.getAttribLocation(this.shaderProgram, "a_texCoord");

    this.positionBuffer = gl.createBuffer()!;
    this.texCoordBuffer = gl.createBuffer()!;
  }

  use() {
    this.gl.useProgram(this.shaderProgram);

    this.gl.uniform2f(this.resolutionUniform, this.gl.canvas.width, this.gl.canvas.height);

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
    this.gl.enableVertexAttribArray(this.positionAttribute);
    this.gl.vertexAttribPointer(this.positionAttribute, 2, this.gl.FLOAT, false, 0, 0);

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.texCoordBuffer);
    this.gl.enableVertexAttribArray(this.texCoordAttribute);
    this.gl.vertexAttribPointer(this.texCoordAttribute, 2, this.gl.FLOAT, false, 0, 0);

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.texCoordBuffer);
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      // prettier-ignore
      new Float32Array([
        0.0, 0.0,
        1.0, 0.0,
        0.0, 1.0,
        1.0, 0.0,
        0.0, 1.0,
        1.0, 1.0
      ]),
      this.gl.STATIC_DRAW
    );
  }

  draw(sprite: SpriteMaterial, position: { x: number; y: number }) {
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);

    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      // prettier-ignore
      new Float32Array([    
        position.x,                position.y,
        position.x + sprite.width, position.y,
        position.x,                position.y + sprite.height,
        position.x + sprite.width, position.y,
        position.x,                position.y + sprite.height,
        position.x + sprite.width, position.y + sprite.height,
    ]),
      this.gl.STATIC_DRAW
    );
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
  }
}

export class SpriteMaterial {
  texture: WebGLTexture;
  width: number;
  height: number;

  constructor(gl: WebGLRenderingContext, sprite: TexImageSource) {
    this.width = sprite.width;
    this.height = sprite.height;

    // Create a texture.
    this.texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);

    // Set the parameters so we can render any size image.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    // Upload the image into the texture.
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sprite);
  }
}
