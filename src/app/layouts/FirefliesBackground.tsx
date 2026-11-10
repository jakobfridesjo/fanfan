import { SceneCanvas } from "@/app/layouts/SceneCanvas.tsx";
import { between, type Scene } from "@/app/layouts/webgl-scene.ts";

const FIREFLY_COUNT = 90;

const FIREFLIES: Scene = {
  floatsPerParticle: 16,
  particles: Float32Array.from(
    Array.from({ length: FIREFLY_COUNT }, () => {
      const driftSeconds = between(40, 90);
      const glowSeconds = between(3, 8);
      return [
        between(0, 1),
        between(0, 1),
        between(2.5, 5.5),
        driftSeconds,
        between(0, driftSeconds),
        glowSeconds,
        between(0, glowSeconds),
        0,
        ...Array.from({ length: 6 }, () => between(-8, 8)),
        0,
        0,
      ];
    }).flat()
  ),
  colors: ["--firefly-color", "--firefly-core"],
  reducedMotion: "hidden",
  framesPerSecond: 30,
  maxPixelRatio: 1,
  vertex: `
out vec2 offset;
out float size;
out float opacity;

/** Through three waypoints (in vmin) and back, easing between each. */
vec2 drift(float progress) {
  if (progress < 0.33) return mix(vec2(0.0), a2.xy, ease(progress / 0.33));
  if (progress < 0.66) return mix(a2.xy, a2.zw, ease((progress - 0.33) / 0.33));
  return mix(a2.zw, a3.xy, ease((progress - 0.66) / 0.34));
}

void main() {
  size = a0.z;
  float glow = bounce(a1.y, a1.z);
  opacity = glow < 0.3 ? 0.12 : mix(0.12, 1.0, ease((glow - 0.3) / 0.7));
  vec2 center = a0.xy * resolution + size * 0.5 + drift(bounce(a0.w, a1.x)) * vmin();
  offset = corner * size * 10.5;
  gl_Position = clip(center + offset);
}
`,
  fragment: `
in vec2 offset;
in float size;
in float opacity;

void main() {
  float fromCenter = length(offset);
  float radius = size * 0.5;
  vec3 tint = colors[0].rgb;
  vec3 core = mix(colors[1].rgb, tint, clamp(fromCenter / (radius * 1.4142), 0.0, 1.0));
  float inner = glow(fromCenter, radius + 0.8 * size, 1.25 * size);
  float outer = 0.45 * glow(fromCenter, radius + 2.0 * size, 4.0 * size);
  float halo = inner + outer * (1.0 - inner);
  float body = disc(fromCenter, radius, 1.0);
  fragColor = dither(vec4(core * body + tint * halo * (1.0 - body), body + halo * (1.0 - body)) * opacity);
}
`,
};

/** Fireflies wandering slowly and glowing on and off. */
export function FirefliesBackground() {
  return <SceneCanvas scene={FIREFLIES} className="fireflies" />;
}
