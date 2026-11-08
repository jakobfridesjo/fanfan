import * as React from "react";

const MOBILE_BREAKPOINT = 768;
const MOBILE_MEDIA_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

function getIsMobile() {
  if (typeof globalThis.matchMedia !== "function") {
    return false;
  }

  return globalThis.matchMedia(MOBILE_MEDIA_QUERY).matches;
}

function subscribe(onChange: () => void) {
  if (typeof globalThis.matchMedia !== "function") {
    return () => {};
  }

  const mediaQuery = globalThis.matchMedia(MOBILE_MEDIA_QUERY);
  mediaQuery.addEventListener("change", onChange);
  return () => mediaQuery.removeEventListener("change", onChange);
}

export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getIsMobile);
}
