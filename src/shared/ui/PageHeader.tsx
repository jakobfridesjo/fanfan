import React from "react";
import { ArrowLeft, MoreHorizontal } from "lucide-react";

import { SidebarTrigger } from "@/shared/ui/shadcn/sidebar.tsx";
import { Button } from "@/shared/ui/shadcn/button.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/shared/ui/shadcn/dropdown-menu.tsx";
import { StatusBadge } from "@/shared/ui/StatusBadge.tsx";
import { TooltipIconButton } from "@/shared/ui/TooltipIconButton.tsx";
import { useIsMobile } from "@/shared/lib/use-mobile.ts";
import { headerColor, headerText } from "@/shared/config/env.ts";
import { useMessages } from "@/shared/i18n/messages.ts";
import { cn } from "@/shared/lib/class-names.ts";

function isLightColor(hex: string) {
  const digits = hex.slice(1);
  const rgb = Number.parseInt(digits.length === 3 ? digits.replace(/./g, "$&$&") : digits, 16);
  const [red, green, blue] = [(rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255];
  return 0.299 * red + 0.587 * green + 0.114 * blue > 150;
}

const headerColorStyle = headerColor
  ? { backgroundColor: headerColor, color: isLightColor(headerColor) ? "black" : "white" }
  : undefined;

function HeaderLabel() {
  return (
    <StatusBadge
      tone="warning"
      role="status"
      style={headerColorStyle}
      className="bg-warning font-semibold text-warning-foreground"
    >
      {headerText}
    </StatusBadge>
  );
}

interface PageHeaderProps {
  title: React.ReactNode;
  /** Renders a back arrow to the left of the title. */
  onBack?: () => void;
  backLabel?: string;
  children?: React.ReactNode;
}

function BackButton({ onBack, backLabel }: { onBack: () => void; backLabel: string }) {
  return (
    <TooltipIconButton label={backLabel} variant="ghost" size="icon" onClick={onBack}>
      <ArrowLeft />
    </TooltipIconButton>
  );
}

/**
 * Whether the actions fit inline beside the title. Their width is remembered
 * while inline, so once collapsed they expand again as soon as there is room.
 */
function useActionsFit(enabled: boolean) {
  const rowRef = React.useRef<HTMLDivElement>(null);
  const titleRef = React.useRef<HTMLDivElement>(null);
  const actionsRef = React.useRef<HTMLDivElement>(null);
  const actionsWidth = React.useRef(0);
  const [fits, setFits] = React.useState(true);

  React.useLayoutEffect(() => {
    const row = rowRef.current;
    const title = titleRef.current;
    if (!enabled || !row || !title) return;

    const measure = () => {
      if (actionsRef.current) actionsWidth.current = actionsRef.current.offsetWidth;
      const gap = Number.parseFloat(getComputedStyle(row).columnGap) || 0;
      const room = row.clientWidth - title.offsetWidth - gap;
      setFits(actionsWidth.current <= room);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    observer.observe(title);
    if (actionsRef.current) observer.observe(actionsRef.current);
    return () => observer.disconnect();
  }, [enabled, fits]);

  return { rowRef, titleRef, actionsRef, fits };
}

function ActionsMenu({ children }: { children: React.ReactNode }) {
  const m = useMessages();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="ml-auto" />}>
        <MoreHorizontal className="size-5" />
        <span className="sr-only">{m.common.actions}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto">
        <div className="flex min-w-max flex-col gap-1 p-1 [&>div]:w-full [&>div]:flex-col! [&>div]:items-stretch! [&>div]:gap-1 **:[[role=group]]:flex-col! **:[[role=group]]:items-stretch! **:[[role=group]]:gap-1 **:[[role=group]>*]:rounded-m! **:[[role=group]>*]:border! **:data-[slot=button]:justify-start">
          {children}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function PageHeader({ title, onBack, backLabel, children }: PageHeaderProps) {
  const m = useMessages();
  const isMobile = useIsMobile();
  const hasActions = Boolean(children);
  const { rowRef, titleRef, actionsRef, fits } = useActionsFit(hasActions && !isMobile);
  const collapsed = isMobile || !fits;

  return (
    <div className="mb-1.5 flex shrink-0 flex-col gap-3 sm:min-h-10 sm:justify-center">
      <div
        ref={rowRef}
        style={headerColor ? ({ "--header-color": headerColor } as React.CSSProperties) : undefined}
        className={cn(
          "flex min-h-10 items-center justify-between gap-3",
          headerText &&
            "rounded-2xl bg-[color-mix(in_oklch,var(--header-color,var(--warning))_15%,transparent)] px-1.5"
        )}
      >
        <div ref={titleRef} className="flex min-w-0 items-center gap-2">
          {isMobile && <SidebarTrigger />}
          {onBack && <BackButton onBack={onBack} backLabel={backLabel ?? m.common.back} />}
          <div className="min-w-0 text-lg font-medium">{title}</div>
          {headerText && <HeaderLabel />}
        </div>
        {hasActions &&
          (collapsed ? (
            <ActionsMenu>{children}</ActionsMenu>
          ) : (
            <div className="flex min-w-0 justify-end">
              <div ref={actionsRef} className="flex w-max shrink-0 items-center gap-2">
                {children}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
