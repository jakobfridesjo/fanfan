import { render as mount } from "@solidjs/web";
import type { JSX } from "@solidjs/web";

const mounted = new Set<() => void>();

/** Mounts `ui` in a container of its own under the body; `cleanup` unmounts whatever is left. */
export function render(ui: () => JSX.Element) {
  const container = document.body.appendChild(document.createElement("div"));
  const dispose = mount(ui, container);
  const unmount = () => {
    if (!mounted.delete(unmount)) return;
    // Focus leaves before the owner is disposed: a focusout fired by removing the focused element
    // would reach Kobalte's handlers mid-disposal, where Solid Dev refuses their writes.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    dispose();
    container.remove();
  };
  mounted.add(unmount);
  return { container, unmount };
}

export function cleanup() {
  for (const unmount of mounted) unmount();
}
