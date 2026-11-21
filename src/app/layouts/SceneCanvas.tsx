import { onSettled } from "solid-js";
import { runScene, type Scene } from "@/app/layouts/webgl-scene.ts";
import { cn } from "@/shared/lib/class-names.ts";

/** A background scene on one full-size canvas, behind every page; `class` sets its colours. */
export function SceneCanvas(props: { scene: Scene; class?: string }) {
  let canvas: HTMLCanvasElement | undefined;
  const scene = props.scene;

  onSettled(() => (canvas ? runScene(canvas, scene) : undefined));

  return (
    <div
      aria-hidden="true"
      class={cn("pointer-events-none absolute inset-0 -z-10 overflow-hidden", props.class)}
    >
      <canvas ref={(element) => (canvas = element)} class="block size-full" />
    </div>
  );
}
