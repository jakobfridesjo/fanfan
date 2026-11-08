import { useEffect, useEffectEvent } from "react";

export type KeyBindings = Partial<Record<string, () => void>>;

function isTyping(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

/**
 * Page-wide shortcuts keyed by `KeyboardEvent.key` (" " for space). Ignored
 * while typing, with a modifier held, or while a dialog is open.
 */
export function useKeyBindings(bindings: KeyBindings, enabled = true) {
  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    if (isTyping(event.target) || document.querySelector("[role=dialog],[role=alertdialog]")) {
      return;
    }
    const action = bindings[event.key];
    if (!action) return;
    event.preventDefault();
    action();
  });

  useEffect(() => {
    if (!enabled) return;
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}
