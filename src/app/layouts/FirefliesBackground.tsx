import type { CSSProperties } from "react";

const FIREFLY_COUNT = 90;

function between(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function offset(range: number) {
  return `${between(-range, range)}vmin`;
}

const FIREFLIES = Array.from({ length: FIREFLY_COUNT }, (_, index) => {
  const driftSeconds = between(40, 90);
  const glowSeconds = between(3, 8);
  return {
    id: index,
    style: {
      left: `${between(0, 100)}%`,
      top: `${between(0, 100)}%`,
      "--firefly-size": `${between(2.5, 5.5)}px`,
      "--firefly-x1": offset(8),
      "--firefly-y1": offset(8),
      "--firefly-x2": offset(8),
      "--firefly-y2": offset(8),
      "--firefly-x3": offset(8),
      "--firefly-y3": offset(8),
      animationDuration: `${driftSeconds}s, ${glowSeconds}s`,
      animationDelay: `${-between(0, driftSeconds)}s, ${-between(0, glowSeconds)}s`,
    } as CSSProperties,
  };
});

export function FirefliesBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden motion-reduce:hidden"
    >
      {FIREFLIES.map((firefly) => (
        <span key={firefly.id} className="firefly" style={firefly.style} />
      ))}
    </div>
  );
}
