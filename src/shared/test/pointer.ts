const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

type PointerType = "mouse" | "touch";

const pointer = (type: string, x: number, y: number, pointerType: PointerType = "mouse") =>
  new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    isPrimary: true,
    pointerId: 1,
    pointerType,
    button: 0,
    buttons: type === "pointerup" ? 0 : 1,
    clientX: x,
    clientY: y,
  });

const centerOf = (element: Element) => {
  const box = element.getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
};

interface DragOptions {
  pointerType?: PointerType;
  /** How long to rest on `element` before moving. */
  holdMs?: number;
}

/**
 * Presses on `element`, moves to `end` in `steps` moves one animation frame
 * apart, as motion's drag gesture expects, then releases.
 */
async function drag(
  element: Element,
  end: { x: number; y: number },
  steps: number,
  { pointerType = "mouse", holdMs = 0 }: DragOptions = {}
) {
  const start = centerOf(element);
  const mousePointer = (type: string, x: number, y: number) => pointer(type, x, y, pointerType);
  element.dispatchEvent(mousePointer("pointerdown", start.x, start.y));
  if (holdMs > 0) await new Promise((resolve) => setTimeout(resolve, holdMs));
  for (let step = 1; step <= steps; step++) {
    await nextFrame();
    const x = start.x + ((end.x - start.x) * step) / steps;
    const y = start.y + ((end.y - start.y) * step) / steps;
    window.dispatchEvent(mousePointer("pointermove", x, y));
  }
  await nextFrame();
  window.dispatchEvent(mousePointer("pointerup", end.x, end.y));
}

/** Drags `element` horizontally by `deltaX` with a mouse pointer. */
export async function dragHorizontally(element: Element, deltaX: number, steps = 12) {
  const start = centerOf(element);
  await drag(element, { x: start.x + deltaX, y: start.y }, steps);
}

/** Drags `element` onto the middle of `target` and releases it there. */
export async function dragOnto(
  element: Element,
  target: Element,
  options: DragOptions & { steps?: number } = {}
) {
  await drag(element, centerOf(target), options.steps ?? 8, options);
}
