import { SceneCanvas } from "@/app/layouts/SceneCanvas.tsx";
import type { Scene } from "@/app/layouts/webgl-scene.ts";

/** One quad over the whole canvas: the light of a sun just below the horizon, right of centre. */
const SUNSET: Scene = {
  floatsPerParticle: 1,
  particles: Float32Array.from([0]),
  colors: ["--sunset-glow", "--sunset-ray"],
  reducedMotion: "still",
  framesPerSecond: 20,
  maxPixelRatio: 1,
  vertex: `
out vec2 pixel;
flat out vec2 size;
flat out float seconds;
flat out float breath;

void main() {
  pixel = vec2(corner.x * 0.5 + 0.5, 0.5 - corner.y * 0.5) * resolution;
  size = resolution;
  seconds = time;
  breath = swing(14.0, 0.0);
  gl_Position = vec4(corner, 0.0, 1.0);
}
`,
  fragment: `
in vec2 pixel;
flat in vec2 size;
flat in float seconds;
flat in float breath;

float hash(vec2 point) {
  return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453);
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

void main() {
  vec2 fromSun = pixel - vec2(0.68, 1.08) * size;
  float distance = length(fromSun) / max(size.x, size.y);
  float angle = atan(fromSun.x, -fromSun.y);

  // Crepuscular rays: shafts of uneven width where unseen clouds let the light through. Each one
  // slowly brightens and fades on its own, as those clouds drift.
  float broad = noise(vec2(angle * 13.0, seconds * 0.05));
  float fine = noise(vec2(angle * 41.0 + 7.0, seconds * 0.08));
  float shafts = smoothstep(0.3, 0.9, 0.65 * broad + 0.35 * fine);
  // Haze drifting up through the shafts, so each one is uneven along its length.
  float haze = mix(0.75, 1.0, noise(vec2(angle * 6.0, distance * 5.0 - seconds * 0.06)));
  // Rays that would skim the horizon sideways fade out.
  float upward = smoothstep(1.5, 1.05, abs(angle));
  float ray = colors[1].a * shafts * haze * upward * exp(-distance * 1.7)
    * smoothstep(0.0, 0.12, distance);

  // Glare: short fine streaks close to the sun, where the eye is dazzled.
  float streaks = noise(vec2(angle * 120.0, seconds * 0.3));
  float glare = 0.5 * colors[1].a * streaks * streaks * exp(-distance * 7.0);
  ray = ray + glare * (1.0 - ray);

  float glow = colors[0].a * mix(0.85, 1.0, breath) * exp(-distance * distance * 5.0);
  // The whole horizon is lit, brightest under the sun.
  float horizon = 0.35 * colors[0].a * exp(-(1.0 - pixel.y / size.y) * 9.0)
    * mix(0.4, 1.0, exp(-abs(fromSun.x / size.x) * 2.5));
  glow = glow + horizon * (1.0 - glow);

  // Rays take the glow's deeper colour near the horizon and pale as they climb.
  vec3 rayColor = mix(colors[0].rgb, colors[1].rgb, smoothstep(0.05, 0.6, distance));
  vec3 color = colors[0].rgb * glow + rayColor * ray * (1.0 - glow);
  fragColor = dither(vec4(color, glow + ray * (1.0 - glow)));
}
`,
};

/** Sunset: warm light and shifting sun rays fanning up from a sun just set, over an evening sky. */
export function SunsetBackground() {
  return <SceneCanvas scene={SUNSET} className="sunset" />;
}
