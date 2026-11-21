import type { JSX } from "@solidjs/web";
import { Progress as ProgressPrimitive } from "@kobalte/core/progress";
import { cn } from "@/shared/lib/class-names.ts";

interface ProgressProps {
  /** From 0 to 100; null while how far it has come is unknown. */
  value: number | null;
  "aria-label"?: string;
  /** How the value is written as text (and read to screen readers). */
  formatValue?: (percent: number) => string;
  class?: string;
  /** A `ProgressLabel` and `ProgressValue`, above the bar. */
  children?: JSX.Element;
}

function Progress(props: ProgressProps) {
  return (
    <ProgressPrimitive
      data-slot="progress"
      aria-label={props["aria-label"]}
      value={props.value ?? 0}
      indeterminate={props.value === null}
      getValueLabel={({ value }) => (props.formatValue ? props.formatValue(value) : `${value}%`)}
      class={cn("flex flex-wrap gap-3", props.class)}
    >
      {props.children}
      <ProgressPrimitive.Track
        data-slot="progress-track"
        class="relative flex h-2 w-full items-center overflow-x-hidden rounded-2xl bg-muted"
      >
        <ProgressPrimitive.Fill
          data-slot="progress-indicator"
          class="h-full w-(--kb-progress-fill-width) bg-primary transition-all data-indeterminate:w-1/3 data-indeterminate:animate-pulse"
        />
      </ProgressPrimitive.Track>
    </ProgressPrimitive>
  );
}

function ProgressLabel(props: { children: JSX.Element }) {
  return (
    <ProgressPrimitive.Label data-slot="progress-label" class="text-sm font-medium">
      {props.children}
    </ProgressPrimitive.Label>
  );
}

function ProgressValue() {
  return (
    <ProgressPrimitive.ValueLabel
      data-slot="progress-value"
      class="ml-auto text-sm text-muted-foreground tabular-nums"
    />
  );
}

export { Progress, ProgressLabel, ProgressValue };
