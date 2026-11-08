import type { ComponentProps } from "react";
import { Badge } from "@/shared/ui/shadcn/badge.tsx";
import { cn } from "@/shared/lib/class-names.ts";
import { activeLabel, STATUS_TONE_CLASSNAMES, type StatusTone } from "@/shared/ui/status-tone.ts";

export function StatusBadge({
  tone,
  className,
  ...props
}: Omit<ComponentProps<typeof Badge>, "variant"> & { tone: StatusTone }) {
  return (
    <Badge variant="secondary" className={cn(STATUS_TONE_CLASSNAMES[tone], className)} {...props} />
  );
}

/** The Active/Inactive badge every entity table renders in a centered status column. */
export function ActiveBadge({
  isActive,
  centered = true,
}: {
  isActive: boolean;
  centered?: boolean;
}) {
  const badge = (
    <StatusBadge tone={isActive ? "success" : "muted"}>{activeLabel(isActive)}</StatusBadge>
  );
  return centered ? <div className="flex justify-center">{badge}</div> : badge;
}
