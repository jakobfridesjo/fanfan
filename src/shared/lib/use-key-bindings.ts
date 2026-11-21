import { createEffect, createMemo } from "solid-js";

export type KeyBindings = Partial<Record<string, () => void>>;

function isTyping(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

/**
 * Page-wide shortcuts keyed by `KeyboardEvent.key` (" " for space). Ignored
 * while typing, with a modifier held, or while a dialog is open. `bindings` is
 * read at each key press, so it may be a getter over what changes.
 */
export function useKeyBindings(bindings: () => KeyBindings, enabled: () => boolean = () => true) {
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    if (isTyping(event.target) || document.querySelector("[role=dialog],[role=alertdialog]")) {
      return;
    }
    const action = bindings()[event.key];
    if (!action) return;
    event.preventDefault();
    action();
  };

  const on = createMemo(enabled);
  createEffect(on, (isOn) => {
    if (!isOn) return;
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });
}
