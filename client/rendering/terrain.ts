import { shader, program } from "./utils.ts";

import VERTEX from "./shaders/terrain.vert";
import FRAGMENT from "./shaders/terrain.frag";
import { QuadTree, traverseQuadTree } from "../../shared/quad-tree.ts";

export class TerrainRenderPass {
  private positionBuffer: WebGLBuffer;

  private fragmentShader: WebGLShader;
  private vertexShader: WebGLShader;

  private shaderProgram: WebGLProgram;

  private resolutionUniform: WebGLUniformLocation;

  private positionAttribute: number;

  constructor(private gl: WebGLRenderingContext) {
    this.vertexShader = shader(gl, "vertex", VERTEX);
    this.fragmentShader = shader(gl, "fragment", FRAGMENT);

    this.shaderProgram = program(gl, this.vertexShader, this.fragmentShader);

    this.resolutionUniform = gl.getUniformLocation(this.shaderProgram, "u_resolution")!;

    this.positionAttribute = gl.getAttribLocation(this.shaderProgram, "a_position");

    this.positionBuffer = gl.createBuffer()!;
  }

  use() {
    this.gl.useProgram(this.shaderProgram);

    this.gl.uniform2f(this.resolutionUniform, this.gl.canvas.width, this.gl.canvas.height);

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
    this.gl.enableVertexAttribArray(this.positionAttribute);
    this.gl.vertexAttribPointer(this.positionAttribute, 2, this.gl.FLOAT, false, 0, 0);
  }

  draw(terrain: QuadTree<boolean>) {
    const verticies: number[] = [];

    traverseQuadTree(terrain, (area, visible) => {
      if (visible) {
        // prettier-ignore
        verticies.push(
          area.x,          area.y,
          area.x + area.w, area.y,
          area.x,          area.y + area.h,
          area.x + area.w, area.y,
          area.x,          area.y + area.h,
          area.x + area.w, area.y + area.h
        );
      }
    });

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(verticies), this.gl.STATIC_DRAW);
    this.gl.drawArrays(this.gl.TRIANGLES, 0, verticies.length / 2);
  }
}
