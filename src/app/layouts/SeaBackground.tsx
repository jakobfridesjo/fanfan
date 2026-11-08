import { SceneCanvas } from "@/app/layouts/SceneCanvas.tsx";
import type { Scene } from "@/app/layouts/webgl-scene.ts";

function between(min: number, max: number) {
  return min + Math.random() * (max - min);
}

/**
 * Lights rising like bubbles through cold water, wobbling and flickering. One in eight is large
 * and out of focus, drifting past close to the eye.
 */
const LIGHTS: Scene = {
  floatsPerParticle: 12,
  particles: Float32Array.from(
    Array.from({ length: 48 }, (_, index) => {
      const near = index % 8 === 0;
      const size = near ? between(14, 26) : between(2, 6);
      const riseSeconds = near ? between(30, 45) : between(28, 70);
      const wobbleSeconds = between(3, 7);
      const flickerSeconds = between(2, 6);
      return [
        between(0, 1),
        riseSeconds,
        between(0, riseSeconds),
        size,
        near ? size * 0.35 : size * 0.12,
        between(1, 4),
        near ? 0.25 : between(0.45, 0.8),
        0,
        wobbleSeconds,
        between(0, wobbleSeconds),
        flickerSeconds,
        between(0, flickerSeconds),
      ];
    }).flat()
  ),
  colors: ["--sea-halo", "--sea-core"],
  reducedMotion: "hidden",
  vertex: `
out vec2 offset;
out float size;
out float blur;
out float opacity;

void main() {
  size = a0.w;
  blur = a1.x;
  opacity = a1.z * mix(0.4, 1.0, swing(a2.z, a2.w));
  vec2 center = vec2(a0.x, 1.05 - loop(a0.y, a0.z) * 1.2) * resolution + size * 0.5;
  center.x += mix(-a1.y, a1.y, swing(a2.x, a2.y)) * vmin();
  offset = corner * (6.7 * size + 2.0 * blur + 1.0);
  gl_Position = clip(center + offset);
}
`,
  fragment: `
in vec2 offset;
in float size;
in float blur;
in float opacity;

void main() {
  float fromCenter = length(offset);
  float radius = size * 0.5;
  vec3 halo = colors[0].rgb;
  vec3 core = mix(colors[1].rgb, halo, clamp((fromCenter / (radius * 1.4142) - 0.3) / 0.7, 0.0, 1.0));
  float inner = glow(fromCenter, radius + 0.4 * size, length(vec2(0.75 * size, blur)));
  float outer = 0.3 * glow(fromCenter, radius + 1.2 * size, length(vec2(2.5 * size, blur)));
  float shine = inner + outer * (1.0 - inner);
  float body = disc(fromCenter, radius, 2.0 * blur + 0.5);
  fragColor = dither(vec4(core * body + halo * shine * (1.0 - body), body + shine * (1.0 - body)) * opacity);
}
`,
};

/** Sea: an icy blue night with soft lights rising through it. */
export function SeaBackground() {
  return <SceneCanvas scene={LIGHTS} className="sea" />;
}
