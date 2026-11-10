/**
 * A WebGL2 background: one instanced quad per particle, drawn in a single call. Each particle's
 * random parameters are uploaded once; the scene's vertex shader turns them and `time` into its
 * position, so a frame costs one uniform and one draw call.
 */
export interface Scene {
  /** Up to 16 floats per particle, read in the vertex shader as the vec4s `a0`..`a3`. */
  floatsPerParticle: number;
  particles: Float32Array;
  /** CSS custom properties read from the canvas, available in both shaders as `colors[i]`. */
  colors: string[];
  /** GLSL after the shared header: `main` sets `gl_Position` from `corner` (-1..1) and `a0`..`a3`. */
  vertex: string;
  /** GLSL after the shared header: `main` writes premultiplied `fragColor`. */
  fragment: string;
  /** With reduced motion, either one still frame or nothing. */
  reducedMotion: "still" | "hidden";
  /** Slow scenes look the same at a lower rate, and so do the cards blurring them. */
  framesPerSecond: number;
  /** Device pixels per CSS pixel at most: soft glows look the same rendered small and scaled up. */
  maxPixelRatio: number;
}

const MAX_COLORS = 4;

const VERTEX_HEADER = `#version 300 es
precision highp float;
in vec2 corner;
in vec4 a0;
in vec4 a1;
in vec4 a2;
in vec4 a3;
uniform float time;
uniform vec2 resolution;
uniform vec4 colors[${MAX_COLORS}];
const float PI = 3.14159265;

/** CSS \`ease-in-out\`. */
float ease(float progress) {
  return 0.5 - 0.5 * cos(PI * clamp(progress, 0.0, 1.0));
}

/** CSS \`infinite alternate\` before easing: 0 to 1 and back over twice \`seconds\`. */
float bounce(float seconds, float delay) {
  float progress = mod((time + delay) / seconds, 2.0);
  return progress > 1.0 ? 2.0 - progress : progress;
}

/** CSS \`ease-in-out infinite alternate\`. */
float swing(float seconds, float delay) {
  return ease(bounce(seconds, delay));
}

/** CSS \`linear infinite\`: 0 to 1, then again. */
float loop(float seconds, float delay) {
  return fract((time + delay) / seconds);
}

float vmin() { return min(resolution.x, resolution.y) / 100.0; }
float vmax() { return max(resolution.x, resolution.y) / 100.0; }

/** A point in CSS pixels from the top left. */
vec4 clip(vec2 pixels) {
  return vec4(pixels / resolution * vec2(2.0, -2.0) + vec2(-1.0, 1.0), 0.0, 1.0);
}
`;

const FRAGMENT_HEADER = `#version 300 es
precision highp float;
uniform vec4 colors[${MAX_COLORS}];
out vec4 fragColor;

/** Coverage of a disc of radius \`at\`, softened over \`halfWidth\` either side. */
float disc(float fromCenter, float at, float halfWidth) {
  return 1.0 - smoothstep(at - halfWidth, at + halfWidth, fromCenter);
}

/** Noise of under one 8-bit step, so wide faint glows fade without visible bands. */
vec4 dither(vec4 color) {
  float noise = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  return color + (noise - 0.5) / 255.0 * step(0.002, color.a);
}

/** A disc under a Gaussian blur: a CSS box-shadow whose blur radius is twice \`sigma\`. */
float glow(float fromCenter, float radius, float sigma) {
  float variance = sigma * sigma;
  float peak = 1.0 - exp(-radius * radius / (2.0 * variance));
  return peak * exp(-fromCenter * fromCenter / (2.0 * (variance + radius * radius / 4.0)));
}
`;

/** The quad every particle is drawn on, as a triangle strip. */
const CORNERS = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);

let colorContext: CanvasRenderingContext2D | null | undefined;

/** Lets the browser parse any CSS colour (oklch, color-mix) by painting one pixel with it. */
function parseColor(css: string): number[] {
  colorContext ??= document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  if (!colorContext || !css.trim()) return [0, 0, 0, 0];
  colorContext.clearRect(0, 0, 1, 1);
  colorContext.fillStyle = "transparent";
  colorContext.fillStyle = css;
  colorContext.fillRect(0, 0, 1, 1);
  return Array.from(colorContext.getImageData(0, 0, 1, 1).data, (channel) => channel / 255);
}

function compile(gl: WebGL2RenderingContext, type: GLenum, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS) && !gl.isContextLost()) {
    // oxlint-disable-next-line no-console -- a broken shader only blanks the background
    console.error("[Background shader]", gl.getShaderInfoLog(shader));
  }
  return shader;
}

function createRenderer(gl: WebGL2RenderingContext, scene: Scene) {
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_HEADER + scene.vertex);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_HEADER + scene.fragment);
  const program = gl.createProgram();
  if (!vertex || !fragment || !program) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    if (!gl.isContextLost()) {
      // oxlint-disable-next-line no-console -- a broken shader only blanks the background
      console.error("[Background shader]", gl.getProgramInfoLog(program));
    }
    return null;
  }

  const vertexArray = gl.createVertexArray();
  gl.bindVertexArray(vertexArray);

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, CORNERS, gl.STATIC_DRAW);
  const corner = gl.getAttribLocation(program, "corner");
  gl.enableVertexAttribArray(corner);
  gl.vertexAttribPointer(corner, 2, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, scene.particles, gl.STATIC_DRAW);
  const stride = scene.floatsPerParticle * Float32Array.BYTES_PER_ELEMENT;
  for (let index = 0; index * 4 < scene.floatsPerParticle; index++) {
    const location = gl.getAttribLocation(program, `a${index}`);
    if (location < 0) continue;
    gl.enableVertexAttribArray(location);
    const size = Math.min(4, scene.floatsPerParticle - index * 4);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, stride, index * 16);
    gl.vertexAttribDivisor(location, 1);
  }

  const time = gl.getUniformLocation(program, "time");
  const resolution = gl.getUniformLocation(program, "resolution");
  const colors = gl.getUniformLocation(program, "colors");
  const count = scene.particles.length / scene.floatsPerParticle;

  gl.useProgram(program);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  return (seconds: number, width: number, height: number, palette: Float32Array) => {
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(time, seconds);
    gl.uniform2f(resolution, width, height);
    gl.uniform4fv(colors, palette);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
  };
}

/** Draws `scene` on `canvas` while the page is visible, until the returned function is called. */
export function runScene(canvas: HTMLCanvasElement, scene: Scene): () => void {
  const gl = canvas.getContext("webgl2", {
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: "low-power",
  });
  if (!gl) return () => {};

  const reducedMotion = globalThis.matchMedia("(prefers-reduced-motion: reduce)");
  const palette = new Float32Array(MAX_COLORS * 4);
  const start = performance.now();
  const frameMs = 1000 / scene.framesPerSecond;
  let draw = createRenderer(gl, scene);
  let frame = 0;
  let lastFrame = -Infinity;

  const readColors = () => {
    const style = getComputedStyle(canvas);
    scene.colors.forEach((name, index) => {
      palette.set(parseColor(style.getPropertyValue(name)), index * 4);
    });
  };

  const render = (now: number) => {
    if (!draw) return;
    const hidden = reducedMotion.matches && scene.reducedMotion === "hidden";
    if (hidden) {
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return;
    }
    draw((now - start) / 1000, canvas.clientWidth, canvas.clientHeight, palette);
  };

  const tick = (now: number) => {
    frame = requestAnimationFrame(tick);
    const elapsed = now - lastFrame;
    if (elapsed < frameMs - 1) return;
    // Carrying the overshoot keeps the average rate when the display's refresh does not divide it.
    lastFrame = elapsed < 2 * frameMs ? now - Math.max(0, elapsed - frameMs) : now;
    render(now);
  };

  const play = () => {
    cancelAnimationFrame(frame);
    if (reducedMotion.matches) render(start);
    else if (document.visibilityState === "visible") frame = requestAnimationFrame(tick);
  };

  const resize = () => {
    const ratio = Math.min(globalThis.devicePixelRatio || 1, scene.maxPixelRatio);
    canvas.width = Math.max(1, Math.round(canvas.clientWidth * ratio));
    canvas.height = Math.max(1, Math.round(canvas.clientHeight * ratio));
    render(reducedMotion.matches ? start : performance.now());
  };

  const restyle = () => {
    readColors();
    render(reducedMotion.matches ? start : performance.now());
  };

  const loseContext = (event: Event) => {
    event.preventDefault();
    cancelAnimationFrame(frame);
    draw = null;
  };

  const restoreContext = () => {
    draw = createRenderer(gl, scene);
    resize();
    play();
  };

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  const themeObserver = new MutationObserver(restyle);
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "data-background"],
  });
  reducedMotion.addEventListener("change", play);
  document.addEventListener("visibilitychange", play);
  canvas.addEventListener("webglcontextlost", loseContext);
  canvas.addEventListener("webglcontextrestored", restoreContext);

  readColors();
  resize();
  play();

  return () => {
    cancelAnimationFrame(frame);
    resizeObserver.disconnect();
    themeObserver.disconnect();
    reducedMotion.removeEventListener("change", play);
    document.removeEventListener("visibilitychange", play);
    canvas.removeEventListener("webglcontextlost", loseContext);
    canvas.removeEventListener("webglcontextrestored", restoreContext);
  };
}

/** A random number from `min` up to `max`, for scattering particles. */
export function between(min: number, max: number) {
  return min + Math.random() * (max - min);
}
