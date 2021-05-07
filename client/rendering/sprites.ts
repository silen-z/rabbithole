import { shader, program } from "./utils.ts";
import { Position } from "../renderer.ts";
import { component } from "../../shared/ecs.ts";

import VERTEX from "./shaders/sprite.vert";
import FRAGMENT from "./shaders/sprite.frag";

export class SpriteRenderPass {
  private positionBuffer: WebGLBuffer;
  private texCoordBuffer: WebGLBuffer;

  private fragmentShader: WebGLShader;
  private vertexShader: WebGLShader;

  private shaderProgram: WebGLProgram;

  private resolutionUniform: WebGLUniformLocation;

  private positionAttribute: number;
  private texCoordAttribute: number;

  constructor(private gl: WebGLRenderingContext) {
    this.vertexShader = shader(gl, "vertex", VERTEX);
    this.fragmentShader = shader(gl, "fragment", FRAGMENT);

    this.shaderProgram = program(gl, this.vertexShader, this.fragmentShader);

    this.resolutionUniform = gl.getUniformLocation(this.shaderProgram, "u_resolution")!;

    this.positionAttribute = gl.getAttribLocation(this.shaderProgram, "a_position");
    this.texCoordAttribute = gl.getAttribLocation(this.shaderProgram, "a_texCoord");

    this.positionBuffer = gl.createBuffer()!;
    this.texCoordBuffer = gl.createBuffer()!;

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

  use() {
    this.gl.useProgram(this.shaderProgram);

    this.gl.uniform2f(this.resolutionUniform, this.gl.canvas.width, this.gl.canvas.height);

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
    this.gl.enableVertexAttribArray(this.positionAttribute);
    this.gl.vertexAttribPointer(this.positionAttribute, 2, this.gl.FLOAT, false, 0, 0);

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.texCoordBuffer);
    this.gl.enableVertexAttribArray(this.texCoordAttribute);
    this.gl.vertexAttribPointer(this.texCoordAttribute, 2, this.gl.FLOAT, false, 0, 0);
  }

  draw(sprite: SpriteMaterial, position: Position) {
    // prettier-ignore
    const verticies = new Float32Array([    
        position.x,                position.y,
        position.x + sprite.width, position.y,
        position.x,                position.y + sprite.height,
        position.x + sprite.width, position.y,
        position.x,                position.y + sprite.height,
        position.x + sprite.width, position.y + sprite.height,
      ]);

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, verticies, this.gl.STATIC_DRAW);
    this.gl.bindTexture(this.gl.TEXTURE_2D, sprite.texture);
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

export const Sprite = component<SpriteMaterial>({ name: "Sprite" });
