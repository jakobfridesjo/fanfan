import type { JSX } from "@solidjs/web";
import { Portal } from "@solidjs/web";
import { createEffect, createSignal, createUniqueId, onSettled, Show } from "solid-js";
import type {
  ChartRenderer,
  ChartTextMeasurer,
  ChartTooltipBodyTarget,
  ChartValue,
  DomChartDefinition,
} from "@tanstack/charts";
import { createChartRendererAdapter } from "@tanstack/charts/adapter/renderer";

interface ChartProps<TDatum, TXValue extends ChartValue, TYValue extends ChartValue> {
  definition: DomChartDefinition<TDatum, TXValue, TYValue>;
  renderer: ChartRenderer<NoInfer<TDatum>, NoInfer<TXValue>, NoInfer<TYValue>>;
  ariaLabel: string;
  measureText?: ChartTextMeasurer;
  style?: JSX.CSSProperties;
  /** Draws the tooltip for the points in focus, in the library's bare tooltip shell. */
  renderTooltipBody: (target: ChartTooltipBodyTarget<TDatum, TXValue, TYValue>) => JSX.Element;
}

/** TanStack Charts' renderer host, kept in step with `definition` and the labels. */
export function Chart<
  TDatum,
  TXValue extends ChartValue = ChartValue,
  TYValue extends ChartValue = ChartValue,
>(props: ChartProps<TDatum, TXValue, TYValue>) {
  const idPrefix = `ts-chart-${createUniqueId().replaceAll(/[^a-zA-Z0-9_-]/g, "")}`;
  const [tooltip, setTooltip] = createSignal<ChartTooltipBodyTarget<
    TDatum,
    TXValue,
    TYValue
  > | null>(null);
  const options = () => ({
    definition: props.definition,
    renderer: props.renderer,
    ariaLabel: props.ariaLabel,
    measureText: props.measureText,
    idPrefix,
    initialWidth: 640,
    onTooltipBodyChange: (target: ChartTooltipBodyTarget<TDatum, TXValue, TYValue> | null) =>
      void setTooltip(() => target),
  });
  let surface: HTMLDivElement | undefined;
  let adapter: ReturnType<typeof createChartRendererAdapter<TDatum, TXValue, TYValue>> | undefined;

  onSettled(() => {
    if (!surface) return;
    const mounted = createChartRendererAdapter(options());
    adapter = mounted;
    mounted.mount(surface);
    return () => mounted.destroy();
  });
  createEffect(options, (next) => adapter?.update(next), { defer: true });

  return (
    <>
      <div class="ts-chart-host" style={{ position: "relative", width: "100%", ...props.style }}>
        <div
          ref={(element) => (surface = element)}
          class="ts-chart-surface"
          style={{ width: "100%", height: "100%" }}
        />
      </div>
      <Show when={tooltip()}>
        {(target) => <Portal mount={target().element}>{props.renderTooltipBody(target())}</Portal>}
      </Show>
    </>
  );
}
