import { SceneCanvas } from "@/app/layouts/SceneCanvas.tsx";
import type { Scene } from "@/app/layouts/webgl-scene.ts";

/**
 * One quad over the whole canvas: a shan shui ink painting. Ranges recede in paler washes, each
 * darkest along its ridge and dissolving into the mist at its foot, where banks of mist drift.
 */
const INK: Scene = {
  floatsPerParticle: 1,
  particles: Float32Array.from([0]),
  colors: ["--ink-paper", "--ink-stroke", "--ink-mist"],
  reducedMotion: "still",
  framesPerSecond: 15,
  maxPixelRatio: 1,
  vertex: `
out vec2 pixel;
flat out vec2 size;
flat out float seconds;

void main() {
  pixel = vec2(corner.x * 0.5 + 0.5, 0.5 - corner.y * 0.5) * resolution;
  size = resolution;
  seconds = time;
  gl_Position = vec4(corner, 0.0, 1.0);
}
`,
  fragment: `
in vec2 pixel;
flat in vec2 size;
flat in float seconds;

const int RANGES = 5;

float hash(float n) {
  return fract(sin(n * 127.1) * 43758.5453);
}

float hash(vec2 point) {
  return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(float x) {
  float cell = floor(x);
  return mix(hash(cell), hash(cell + 1.0), smoothstep(0.0, 1.0, fract(x)));
}

float noise(vec2 point) {
  vec2 cell = floor(point);
  vec2 along = smoothstep(0.0, 1.0, fract(point));
  return mix(
    mix(hash(cell), hash(cell + vec2(1.0, 0.0)), along.x),
    mix(hash(cell + vec2(0.0, 1.0)), hash(cell + vec2(1.0, 1.0)), along.x),
    along.y
  );
}

/** Peaks as sharp as a brush lifts them: ridged noise, 0 to about 1. */
float peaks(float x, float seed) {
  float height = 0.0;
  float amplitude = 0.5;
  for (int octave = 0; octave < 5; octave++) {
    height += amplitude * (1.0 - abs(2.0 * noise(x + seed * 17.3) - 1.0));
    x *= 2.1;
    amplitude *= 0.5;
  }
  return height;
}

/** The height of range \`index\` at \`x\`, in screen heights from the top. */
float ridgeAt(int index, float x, float width) {
  float near = float(index) / float(RANGES - 1);
  // The nearer ranges rise at the sides and sink in the middle, leaving the page open.
  float sides = mix(1.0, 0.3 + 0.7 * smoothstep(0.1, 0.5, abs(x / width - 0.5)), near);
  float height = peaks(x * mix(3.2, 1.6, near), float(index));
  return mix(0.5, 0.86, near) - mix(0.12, 0.5, near) * sides * height * height;
}

void main() {
  // Measured in screen heights, so a wide window shows more mountains, not wider ones.
  vec2 point = pixel / size.y;
  float width = size.x / size.y;

  vec3 color = mix(colors[0].rgb, colors[2].rgb, point.y * 0.6);

  for (int index = 0; index < RANGES; index++) {
    float near = float(index) / float(RANGES - 1);
    float depth = point.y - ridgeAt(index, point.x, width);

    // Wet ink bleeds into the paper: the edge wanders and softens where the brush was wettest.
    float wet = noise(point * vec2(9.0, 14.0) + float(index) * 5.0);
    float bleed = mix(0.002, 0.012, wet) * mix(1.6, 0.8, near);
    float edge = depth + (noise(point * 60.0 + float(index)) - 0.5) * 0.006;
    float inside = smoothstep(-bleed, bleed, edge);

    // Strokes run down the slopes, so the wash is streaked like a brush's dry edge, and the ink
    // pools in blotches where it settled.
    float frequency = mix(3.2, 1.6, near);
    float strokes = noise(vec2(point.x * frequency * 30.0 + depth * 8.0, depth * 10.0 + float(index) * 9.0));
    float pooled = 0.6 * noise(point * 3.0 + float(index) * 7.0) + 0.4 * noise(point * 7.0 - float(index));
    float wash = exp(-max(edge, 0.0) * mix(12.0, 6.0, near)) * mix(0.55, 1.35, pooled)
      * mix(0.75, 1.15, strokes);
    // The brush's outline: a darker line along the ridge, pooled where it slowed.
    float outline = exp(-max(edge, 0.0) * 140.0) * mix(0.3, 0.7, wet);
    float ink = colors[1].a * mix(0.4, 1.0, near) * (wash + outline);
    color = mix(color, mix(colors[2].rgb, colors[1].rgb, clamp(ink, 0.0, 1.0)), inside);

    float drift = point.x * 2.2 - seconds * 0.012 * (1.0 + near);
    float bank = exp(-pow((point.y - mix(0.5, 0.86, near) + 0.05) / 0.08, 2.0))
      * smoothstep(0.2, 0.8, noise(vec2(drift, point.y * 5.0 + float(index) * 3.0)));
    color = mix(color, colors[2].rgb, colors[2].a * bank);
  }

  // The paper's grain, faintly.
  color *= mix(0.97, 1.0, noise(pixel * 0.9));
  fragColor = dither(vec4(color, 1.0));
}
`,
};

/** Ink wash: misty mountains in ink on rice paper, with drifting mist. */
export function InkBackground() {
  return <SceneCanvas scene={INK} className="ink-wash" />;
}
