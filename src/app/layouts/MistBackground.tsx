import { SceneCanvas } from "@/app/layouts/SceneCanvas.tsx";
import type { Scene } from "@/app/layouts/webgl-scene.ts";

/** Few and large, placed by hand so the canvas is never covered in one corner only. */
const BLOBS = [
  { left: -0.1, top: -0.15, size: 60, seconds: 70 },
  { left: 0.55, top: -0.2, size: 55, seconds: 85 },
  { left: 0.2, top: 0.35, size: 70, seconds: 95 },
  { left: 0.7, top: 0.45, size: 50, seconds: 75 },
  { left: -0.15, top: 0.65, size: 55, seconds: 90 },
];

const MIST: Scene = {
  floatsPerParticle: 5,
  particles: Float32Array.from(
    BLOBS.flatMap(({ left, top, size, seconds }, index) => [
      left,
      top,
      size,
      seconds,
      seconds * (index / BLOBS.length),
    ])
  ),
  colors: ["--mist-fog"],
  reducedMotion: "still",
  vertex: `
out vec2 uv;

void main() {
  float side = a0.z * vmax();
  float drift = swing(a0.w, a1.x);
  vec2 center = a0.xy * resolution + side * 0.5 + mix(vec2(-6.0, -4.0), vec2(8.0, 6.0), drift) * vmin();
  uv = corner;
  gl_Position = clip(center + corner * side * 0.5 * mix(1.0, 1.15, drift));
}
`,
  fragment: `
in vec2 uv;

void main() {
  // radial-gradient(circle, fog, transparent 65%), measured to the corner.
  float alpha = colors[0].a * (1.0 - clamp(length(uv) / (0.65 * 1.4142), 0.0, 1.0));
  fragColor = dither(vec4(colors[0].rgb * alpha, alpha));
}
`,
};

/** Slow banks of grey mist over an overcast sky; they hold still when reduced motion is on. */
export function MistBackground() {
  return <SceneCanvas scene={MIST} className="mist-sky" />;
}
