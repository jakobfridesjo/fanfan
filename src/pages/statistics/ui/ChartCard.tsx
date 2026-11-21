import type { JSX } from "@solidjs/web";
import { Errored, Loading, Match, Show, Switch } from "solid-js";
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
    <div class="size-full p-6 pt-0">
      <Skeleton class="size-full" />
    </div>
  );
}

function ChartCardBody(props: Omit<ChartCardProps, "title" | "description" | "class">) {
  const m = useMessages();
  return (
    <Switch>
      <Match when={props.isLoading}>
        <ChartSkeleton />
      </Match>
      <Match when={props.isError}>
        <CenteredEmpty class="size-full">
          <UnavailableState
            description={m.charts.loadFailed}
            onRetry={() => props.onRetry?.()}
            size="sm"
          />
        </CenteredEmpty>
      </Match>
      <Match when={props.isEmpty}>
        <CenteredEmpty class="size-full">
          <Empty>
            <EmptyDescription>{props.emptyMessage ?? m.charts.noData}</EmptyDescription>
          </Empty>
        </CenteredEmpty>
      </Match>
      <Match when={true}>
        <Errored
          fallback={(_error, reset) => (
            <CenteredEmpty class="size-full">
              <UnavailableState description={m.charts.drawFailed} onRetry={reset} size="sm" />
            </CenteredEmpty>
          )}
        >
          <Loading fallback={<ChartSkeleton />}>{props.children}</Loading>
        </Errored>
      </Match>
    </Switch>
  );
}

interface ChartCardProps {
  title: string;
  description?: JSX.Element;
  children: JSX.Element;
  isLoading?: boolean;
  isError?: boolean;
  isEmpty?: boolean;
  emptyMessage?: string;
  onRetry?: () => void;
  class?: string;
}

/** A titled card whose body is a chart filling the space below the header. */
export function ChartCard(props: ChartCardProps) {
  return (
    <Card class={cn(CARD_CLASS, props.class)} role="group" aria-label={props.title}>
      <CardHeader class="gap-0">
        <CardTitle class="leading-none">{props.title}</CardTitle>
        <Show when={props.description}>
          <CardDescription>{props.description}</CardDescription>
        </Show>
      </CardHeader>
      <div class="relative min-h-0 min-w-0 flex-1">
        <ChartCardBody
          isLoading={props.isLoading}
          isError={props.isError}
          isEmpty={props.isEmpty}
          emptyMessage={props.emptyMessage}
          onRetry={props.onRetry}
        >
          {props.children}
        </ChartCardBody>
      </div>
    </Card>
  );
}
