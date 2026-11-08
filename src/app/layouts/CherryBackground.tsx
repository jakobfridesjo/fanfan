import type { CSSProperties } from "react";

const PETAL_COUNT = 36;

function between(min: number, max: number) {
  return min + Math.random() * (max - min);
}

const PETALS = Array.from({ length: PETAL_COUNT }, (_, index) => {
  const fallSeconds = between(14, 30);
  const swaySeconds = between(3, 6);
  return {
    id: index,
    fall: {
      left: `${between(-5, 100)}%`,
      animationDuration: `${fallSeconds}s`,
      animationDelay: `${-between(0, fallSeconds)}s`,
    },
    petal: {
      "--petal-size": `${between(7, 14)}px`,
      "--petal-sway": `${between(3, 9)}vmin`,
      "--petal-spin": `${between(180, 540) * (Math.random() < 0.5 ? -1 : 1)}deg`,
      animationDuration: `${swaySeconds}s`,
      animationDelay: `${-between(0, swaySeconds)}s`,
    } as CSSProperties,
  };
});

/** Cherry blossom petals drifting down over a blush sky; the outer element falls, the inner one sways and turns. */
export function CherryBackground() {
  return (
    <div aria-hidden className="cherry pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {PETALS.map((petal) => (
        <span key={petal.id} className="petal-fall motion-reduce:hidden" style={petal.fall}>
          <span className="petal" style={petal.petal} />
        </span>
      ))}
    </div>
  );
}
