const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

const mousePointer = (type: string, x: number, y: number) =>
  new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    isPrimary: true,
    pointerId: 1,
    pointerType: "mouse",
    button: 0,
    buttons: type === "pointerup" ? 0 : 1,
    clientX: x,
    clientY: y,
  });

const centerOf = (element: Element) => {
  const box = element.getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
};

/**
 * Presses the mouse on `element`, moves it to `end` in `steps` moves one
 * animation frame apart, as motion's drag gesture expects, then releases it.
 */
async function drag(element: Element, end: { x: number; y: number }, steps: number) {
  const start = centerOf(element);
  element.dispatchEvent(mousePointer("pointerdown", start.x, start.y));
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
export async function dragOnto(element: Element, target: Element, steps = 8) {
  await drag(element, centerOf(target), steps);
}
