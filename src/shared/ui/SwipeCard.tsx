import type { ReactNode } from "react";
import { animate, motion, useMotionValue, useTransform, type PanInfo } from "motion/react";
import { cn } from "@/shared/lib/class-names.ts";

export type SwipeDirection = "left" | "right";

/** A drag past this distance (px) or speed (px/s) counts as a swipe. */
const SWIPE_DISTANCE = 120;
const SWIPE_VELOCITY = 600;
const FLING_DISTANCE = 640;

const TINT_CLASS =
  "pointer-events-none absolute inset-0 z-10 rounded-[min(var(--radius-4xl),24px)]";

function swipeDirection({ offset, velocity }: Pick<PanInfo, "offset" | "velocity">) {
  if (offset.x > SWIPE_DISTANCE || velocity.x > SWIPE_VELOCITY) return "right";
  if (offset.x < -SWIPE_DISTANCE || velocity.x < -SWIPE_VELOCITY) return "left";
  return null;
}

interface SwipeCardProps {
  onSwipe: (direction: SwipeDirection) => void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * A card dragged left or right to answer. Give it a `key` per item: it flings
 * off-screen on a swipe and the next card mounts fresh.
 */
export function SwipeCard({ onSwipe, disabled = false, className, children }: SwipeCardProps) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 300], [-12, 12]);
  const leftOpacity = useTransform(x, [-SWIPE_DISTANCE, -24], [1, 0]);
  const rightOpacity = useTransform(x, [24, SWIPE_DISTANCE], [0, 1]);

  const handleDragEnd = (_event: PointerEvent, info: PanInfo) => {
    const direction = swipeDirection(info);
    if (!direction) {
      void animate(x, 0, { type: "spring", stiffness: 500, damping: 35 });
      return;
    }
    const target = direction === "right" ? FLING_DISTANCE : -FLING_DISTANCE;
    void animate(x, target, { duration: 0.18 }).then(() => onSwipe(direction));
  };

  return (
    <motion.div
      drag={disabled ? false : "x"}
      dragMomentum={false}
      onDragEnd={handleDragEnd}
      style={{ x, rotate }}
      initial={{ scale: 0.96, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.15 }}
      className={cn(
        "relative touch-pan-y select-none",
        !disabled && "cursor-grab active:cursor-grabbing",
        className
      )}
    >
      <motion.div
        aria-hidden
        style={{ opacity: leftOpacity }}
        className={cn(TINT_CLASS, "bg-linear-to-r from-warning/20 to-transparent")}
      />
      <motion.div
        aria-hidden
        style={{ opacity: rightOpacity }}
        className={cn(TINT_CLASS, "bg-linear-to-l from-success/20 to-transparent")}
      />
      {children}
    </motion.div>
  );
}
