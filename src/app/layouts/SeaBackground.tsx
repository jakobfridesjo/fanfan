import type { CSSProperties } from "react";

function between(min: number, max: number) {
  return min + Math.random() * (max - min);
}

/**
 * Lights rising like bubbles through cold water: the outer element rises, the inner one wobbles
 * and flickers. One in eight is large and out of focus, drifting past close to the eye.
 */
const LIGHTS = Array.from({ length: 48 }, (_, index) => {
  const near = index % 8 === 0;
  const size = near ? between(14, 26) : between(2, 6);
  const riseSeconds = near ? between(30, 45) : between(28, 70);
  const wobbleSeconds = between(3, 7);
  const flickerSeconds = between(2, 6);
  return {
    id: index,
    rise: {
      left: `${between(0, 100)}%`,
      animationDuration: `${riseSeconds}s`,
      animationDelay: `${-between(0, riseSeconds)}s`,
    },
    light: {
      "--sea-size": `${size}px`,
      "--sea-blur": `${near ? size * 0.35 : size * 0.12}px`,
      "--sea-wobble": `${between(1, 4)}vmin`,
      "--sea-peak": near ? 0.25 : between(0.45, 0.8),
      animationDuration: `${wobbleSeconds}s, ${flickerSeconds}s`,
      animationDelay: `${-between(0, wobbleSeconds)}s, ${-between(0, flickerSeconds)}s`,
    } as CSSProperties,
  };
});

/** Sea: an icy blue night with soft lights rising through it. */
export function SeaBackground() {
  return (
    <div aria-hidden className="sea pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {LIGHTS.map((light) => (
        <span key={light.id} className="sea-rise motion-reduce:hidden" style={light.rise}>
          <span className="sea-light" style={light.light} />
        </span>
      ))}
    </div>
  );
}
