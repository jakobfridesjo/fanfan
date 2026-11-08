import { useEffect, useRef } from "react";
import { runScene, type Scene } from "@/app/layouts/webgl-scene.ts";
import { cn } from "@/shared/lib/class-names.ts";

/** A background scene on one full-size canvas, behind every page; `className` sets its colours. */
export function SceneCanvas({ scene, className }: { scene: Scene; className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvas.current) return;
    return runScene(canvas.current, scene);
  }, [scene]);

  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 -z-10 overflow-hidden", className)}
    >
      <canvas ref={canvas} className="block size-full" />
    </div>
  );
}
