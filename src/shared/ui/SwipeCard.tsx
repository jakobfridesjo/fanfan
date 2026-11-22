import type { JSX } from "@solidjs/web";
import { cn } from "@/shared/lib/class-names.ts";

export type SwipeDirection = "left" | "right";

/** A drag past this distance (px) or speed (px/s) counts as a swipe. */
const SWIPE_DISTANCE = 120;
const SWIPE_VELOCITY = 600;
const FLING_DISTANCE = 640;
/** A press becomes a drag once it has moved this far (px), so a tap inside still clicks. */
const DRAG_START = 3;

const TINT_CLASS =
  "pointer-events-none absolute inset-0 z-10 rounded-[min(var(--radius-4xl),24px)] opacity-0";

function swipeDirection(offset: number, velocity: number): SwipeDirection | null {
  if (offset > SWIPE_DISTANCE || velocity > SWIPE_VELOCITY) return "right";
  if (offset < -SWIPE_DISTANCE || velocity < -SWIPE_VELOCITY) return "left";
  return null;
}

const clamp = (value: number) => Math.min(1, Math.max(0, value));

interface SwipeCardProps {
  onSwipe: (direction: SwipeDirection) => void;
  disabled?: boolean;
  class?: string;
  children: JSX.Element;
}

/**
 * A card dragged left or right to answer. Mount a fresh one per item (a keyed `Show`): it flings
 * off-screen on a swipe and the next card fades in.
 */
export function SwipeCard(props: SwipeCardProps) {
  let card: HTMLDivElement | undefined;
  let leftTint: HTMLDivElement | undefined;
  let rightTint: HTMLDivElement | undefined;
  let drag: {
    startX: number;
    lastX: number;
    lastTime: number;
    velocity: number;
    moved: boolean;
  } | null = null;
  let offset = 0;

  const place = (x: number) => {
    offset = x;
    if (!card) return;
    card.style.transform = `translateX(${x}px) rotate(${(x / 300) * 12}deg)`;
    if (leftTint) leftTint.style.opacity = `${clamp((-x - 24) / (SWIPE_DISTANCE - 24))}`;
    if (rightTint) rightTint.style.opacity = `${clamp((x - 24) / (SWIPE_DISTANCE - 24))}`;
  };

  /** Moves the card to `target` over `duration` ms, frame by frame so the tints follow. */
  const glide = (target: number, duration: number, done?: () => void) => {
    const from = offset;
    const start = performance.now();
    const step = (now: number) => {
      const progress = clamp((now - start) / duration);
      place(from + (target - from) * (1 - (1 - progress) ** 3));
      if (progress < 1) requestAnimationFrame(step);
      else done?.();
    };
    requestAnimationFrame(step);
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!drag) return;
    const now = performance.now();
    const elapsed = now - drag.lastTime;
    if (elapsed > 0) drag.velocity = ((event.clientX - drag.lastX) / elapsed) * 1000;
    drag.lastX = event.clientX;
    drag.lastTime = now;
    const moved = event.clientX - drag.startX;
    if (!drag.moved && Math.abs(moved) < DRAG_START) return;
    drag.moved = true;
    place(moved);
  };

  const endDrag = () => {
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", endDrag);
    window.removeEventListener("pointercancel", endDrag);
    const ended = drag;
    drag = null;
    if (!ended?.moved) return;
    const direction = swipeDirection(offset, ended.velocity);
    if (!direction) {
      glide(0, 200);
      return;
    }
    glide(direction === "right" ? FLING_DISTANCE : -FLING_DISTANCE, 180, () =>
      props.onSwipe(direction)
    );
  };

  const onPointerDown = (event: PointerEvent) => {
    if (props.disabled || event.button !== 0 || drag) return;
    drag = {
      startX: event.clientX,
      lastX: event.clientX,
      lastTime: performance.now(),
      velocity: 0,
      moved: false,
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
  };

  return (
    <div
      ref={(element) => (card = element)}
      onPointerDown={onPointerDown}
      class={cn(
        "relative animate-in touch-pan-y select-none fade-in-0 zoom-in-95",
        !props.disabled && "cursor-grab active:cursor-grabbing",
        props.class
      )}
    >
      <div
        ref={(element) => (leftTint = element)}
        aria-hidden="true"
        class={cn(TINT_CLASS, "bg-linear-to-r from-warning/20 to-transparent")}
      />
      <div
        ref={(element) => (rightTint = element)}
        aria-hidden="true"
        class={cn(TINT_CLASS, "bg-linear-to-l from-success/20 to-transparent")}
      />
      {props.children}
    </div>
  );
}
