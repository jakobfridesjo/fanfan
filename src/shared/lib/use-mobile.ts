import { createSignal, onCleanup, type Accessor } from "solid-js";

const MOBILE_BREAKPOINT = 768;
const MOBILE_MEDIA_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

export function useIsMobile(): Accessor<boolean> {
  if (typeof globalThis.matchMedia !== "function") return () => false;

  const mediaQuery = globalThis.matchMedia(MOBILE_MEDIA_QUERY);
  const [mobile, setMobile] = createSignal(mediaQuery.matches);
  const onChange = () => setMobile(mediaQuery.matches);
  mediaQuery.addEventListener("change", onChange);
  onCleanup(() => mediaQuery.removeEventListener("change", onChange));
  return mobile;
}
