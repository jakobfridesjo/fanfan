import { useEffect, useState } from "react";

const ACTIVITY_EVENTS = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart"] as const;
const ACTIVITY_SAMPLE_MS = 1_000;

/**
 * True once `idleAfterMs` passes without user input. A hidden tab becoming
 * visible counts as input. Disabled, it reads as not idle.
 */
export function useIdle(idleAfterMs: number, enabled = true): boolean {
  const [isIdle, setIsIdle] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    let idleTimer = 0;
    let sampledAt = 0;

    const restartIdleTimer = () => {
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => setIsIdle(true), idleAfterMs);
    };
    const onActivity = () => {
      const now = Date.now();
      if (now - sampledAt < ACTIVITY_SAMPLE_MS) return;
      sampledAt = now;
      setIsIdle(false);
      restartIdleTimer();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") onActivity();
    };

    restartIdleTimer();
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, onActivity, { passive: true });
    }
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearTimeout(idleTimer);
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, onActivity);
      }
      document.removeEventListener("visibilitychange", onVisibilityChange);
      setIsIdle(false);
    };
  }, [enabled, idleAfterMs]);

  return enabled && isIdle;
}
