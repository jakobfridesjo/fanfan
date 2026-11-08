import { useEffect, useState } from "react";

/** Whole seconds since `active` last became true; 0 while inactive. */
export function useElapsedSeconds(active: boolean): number {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!active) return;

    const startedAt = Date.now();
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    return () => {
      clearInterval(timer);
      setElapsed(0);
    };
  }, [active]);

  return elapsed;
}
