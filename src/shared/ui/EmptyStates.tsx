import type { ReactNode } from "react";
import { useMessages } from "@/shared/i18n/messages.ts";
import { cn } from "@/shared/lib/class-names.ts";
import { Button } from "@/shared/ui/shadcn/button.tsx";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/shared/ui/shadcn/empty.tsx";

export function CenteredEmpty({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("flex flex-1 items-center justify-center", className)}>{children}</div>;
}

interface UnavailableStateProps {
  title?: string;
  description: string;
  onRetry?: () => void;
  size?: "default" | "sm";
}

export function UnavailableState({
  title,
  description,
  onRetry,
  size = "default",
}: UnavailableStateProps) {
  const m = useMessages();
  return (
    <Empty>
      <EmptyHeader>
        {title && <EmptyTitle>{title}</EmptyTitle>}
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {onRetry && (
        <EmptyContent>
          <Button variant="outline" size={size} onClick={onRetry}>
            {m.common.tryAgain}
          </Button>
        </EmptyContent>
      )}
    </Empty>
  );
}
