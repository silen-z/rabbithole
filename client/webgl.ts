export function shader(gl: WebGLRenderingContext, type: "vertex" | "fragment", source: string): WebGLShader {
  const shader = gl.createShader(type === "vertex" ? gl.VERTEX_SHADER : gl.FRAGMENT_SHADER)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const error = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Unable to initialize the ${type} shader: ${error}`);
  }

  return shader;
}

export function program(gl: WebGLRenderingContext, ...shaders: WebGLShader[]): WebGLProgram {
  const shaderProgram = gl.createProgram()!;
  for (const shader of shaders) {
    gl.attachShader(shaderProgram, shader);
  }
  gl.linkProgram(shaderProgram);

  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    const error = gl.getProgramInfoLog(shaderProgram);
    gl.deleteProgram(shaderProgram);
    throw new Error(`Unable to initialize the shader program: ${error}`);
  }

  return shaderProgram;
}
