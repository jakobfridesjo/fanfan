import { SceneCanvas } from "@/app/layouts/SceneCanvas.tsx";
import type { Scene } from "@/app/layouts/webgl-scene.ts";

const PETAL_COUNT = 36;

function between(min: number, max: number) {
  return min + Math.random() * (max - min);
}

const PETALS: Scene = {
  floatsPerParticle: 8,
  particles: Float32Array.from(
    Array.from({ length: PETAL_COUNT }, () => {
      const fallSeconds = between(14, 30);
      const swaySeconds = between(3, 6);
      return [
        between(-0.05, 1),
        fallSeconds,
        between(0, fallSeconds),
        between(7, 14),
        between(3, 9),
        between(180, 540) * (Math.random() < 0.5 ? -1 : 1),
        swaySeconds,
        between(0, swaySeconds),
      ];
    }).flat()
  ),
  colors: ["--petal-light", "--petal-deep"],
  reducedMotion: "hidden",
  vertex: `
out vec2 uv;

void main() {
  vec2 box = vec2(a0.w, a0.w * 0.7);
  float sway = swing(a1.z, a1.w);
  float fall = loop(a0.y, a0.z);
  vec2 center = vec2(a0.x, fall * 1.1 - 0.05) * resolution + box * 0.5;
  center.x += mix(-a1.x, a1.x, sway) * vmin();
  vec2 local = corner * (box * 0.5 + 1.0);
  uv = local / box + 0.5;
  float angle = radians(a1.y) * sway;
  mat2 turn = mat2(cos(angle), sin(angle), -sin(angle), cos(angle));
  gl_Position = clip(center + turn * local);
}
`,
  fragment: `
in vec2 uv;

void main() {
  // border-radius: 100% 0 100% 0, the overlap of two quarter ellipses.
  float edge = max(length(uv - 1.0), length(uv)) - 1.0;
  float soft = fwidth(edge);
  float inside = 1.0 - smoothstep(-soft, soft, edge);
  vec4 color = mix(colors[0], colors[1], (uv.x + uv.y) * 0.5);
  fragColor = vec4(color.rgb * color.a, color.a) * inside;
}
`,
};

/** Cherry blossom petals drifting down over a blush sky, swaying and turning as they fall. */
export function CherryBackground() {
  return <SceneCanvas scene={PETALS} className="cherry" />;
}
