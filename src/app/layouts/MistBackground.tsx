import type { CSSProperties } from "react";

/** Few and large, placed by hand so the canvas is never covered in one corner only. */
const BLOBS = [
  { left: "-10%", top: "-15%", size: 60, seconds: 70 },
  { left: "55%", top: "-20%", size: 55, seconds: 85 },
  { left: "20%", top: "35%", size: 70, seconds: 95 },
  { left: "70%", top: "45%", size: 50, seconds: 75 },
  { left: "-15%", top: "65%", size: 55, seconds: 90 },
].map(({ left, top, size, seconds }, index) => ({
  id: index,
  style: {
    left,
    top,
    "--mist-size": `${size}vmax`,
    animationDuration: `${seconds}s`,
    animationDelay: `${-seconds * (index / 5)}s`,
  } as CSSProperties,
}));

/** Slow banks of grey mist over an overcast sky; they hold still when reduced motion is on. */
export function MistBackground() {
  return (
    <div
      aria-hidden
      className="mist-sky pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      {BLOBS.map((blob) => (
        <span key={blob.id} className="mist motion-reduce:animate-none" style={blob.style} />
      ))}
    </div>
  );
}
