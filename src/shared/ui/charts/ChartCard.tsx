import { Suspense, type ReactNode } from "react";
import { CatchBoundary } from "@tanstack/react-router";
import { useMessages } from "@/shared/i18n/messages.ts";
import { cn } from "@/shared/lib/class-names.ts";
import { CenteredEmpty, UnavailableState } from "@/shared/ui/EmptyStates.tsx";
import { Card, CardDescription, CardHeader, CardTitle } from "@/shared/ui/shadcn/card.tsx";
import { Empty, EmptyDescription } from "@/shared/ui/shadcn/empty.tsx";
import { Skeleton } from "@/shared/ui/shadcn/skeleton.tsx";

// The chart's SVG is the tab stop; the card paints its focus ring.
const CARD_CLASS = cn(
  "flex min-h-64 shrink-0 flex-col overflow-hidden pb-0",
  "has-[.ts-chart:focus-visible]:ring-3 has-[.ts-chart:focus-visible]:ring-ring/30"
);

function ChartSkeleton() {
  return (
    <div className="size-full p-6 pt-0">
      <Skeleton className="size-full" />
    </div>
  );
}

function ChartDrawError({ reset }: { reset: () => void }) {
  const m = useMessages();
  return (
    <CenteredEmpty className="size-full">
      <UnavailableState description={m.charts.drawFailed} onRetry={reset} size="sm" />
    </CenteredEmpty>
  );
}

function ChartCardBody({
  isLoading,
  isError,
  isEmpty,
  emptyMessage,
  onRetry,
  children,
}: Omit<ChartCardProps, "title" | "description" | "className">) {
  const m = useMessages();
  if (isLoading) return <ChartSkeleton />;
  if (isError) {
    return (
      <CenteredEmpty className="size-full">
        <UnavailableState description={m.charts.loadFailed} onRetry={onRetry} size="sm" />
      </CenteredEmpty>
    );
  }
  if (isEmpty) {
    return (
      <CenteredEmpty className="size-full">
        <Empty>
          <EmptyDescription>{emptyMessage ?? m.charts.noData}</EmptyDescription>
        </Empty>
      </CenteredEmpty>
    );
  }
  return (
    <CatchBoundary getResetKey={() => "chart"} errorComponent={ChartDrawError}>
      <Suspense fallback={<ChartSkeleton />}>{children}</Suspense>
    </CatchBoundary>
  );
}

interface ChartCardProps {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  isLoading?: boolean;
  isError?: boolean;
  isEmpty?: boolean;
  emptyMessage?: string;
  onRetry?: () => void;
  className?: string;
}

/** A titled card whose body is a chart filling the space below the header. */
export function ChartCard({ title, description, className, ...body }: ChartCardProps) {
  return (
    <Card className={cn(CARD_CLASS, className)} role="group" aria-label={title}>
      <CardHeader className="gap-0">
        <CardTitle className="leading-none">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <div className="relative min-h-0 min-w-0 flex-1">
        <ChartCardBody {...body} />
      </div>
    </Card>
  );
}
