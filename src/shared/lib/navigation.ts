export function origin(): string | null {
  return typeof window === "undefined" ? null : window.location.origin;
}
