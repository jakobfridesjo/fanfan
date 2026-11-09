import type { CSSProperties } from "react";
import type {
  ChartGuideLineStyle,
  ChartTextMeasurer,
  ChartTextMetrics,
  ChartTheme,
} from "@tanstack/charts";
import { motion } from "@tanstack/charts/motion";
import { tooltip } from "@tanstack/charts/tooltip";
import { portal } from "@tanstack/charts/tooltip/portal";

export const CHART_THEME = {
  foreground: "var(--color-muted-foreground)",
  muted: "var(--color-muted-foreground)",
  grid: "var(--color-border)",
  background: "transparent",
} satisfies Partial<ChartTheme>;

export const CHART_GRID = { strokeOpacity: 0.5 } satisfies ChartGuideLineStyle;

export const TICK_LABELS = { fontSize: 11 };

// Fills the card's chart area without adding intrinsic height to it: in flow, the SVG's
// viewBox would make the card as tall as the chart's last measurement scaled by its width.
export const FILL_HOST_STYLE: CSSProperties = { position: "absolute", inset: 0, height: "100%" };

// The portal escapes the card's overflow clipping; ChartTooltipBody paints the surface. The
// portal shell is a popover, whose UA `overflow: auto` would clip the body's shadow to a square.
const CHART_TOOLTIP = {
  use: tooltip,
  portal,
  sticky: false,
  className: "overflow-visible",
} as const;

// Pinned to the plot top beside the focused x, so spiky data neither drags the tooltip up and
// down nor flips it above/below the point whenever a peak nears the viewport edge.
export const X_FOCUS_TOOLTIP = {
  ...CHART_TOOLTIP,
  anchor: { x: "point", y: "plot-top" },
  placement: ["bottom-right", "bottom-left"],
} as const;

// Eases entrances, data changes and tooltip moves. Size changes relayout immediately (the
// default), so charts track the sidebar slide frame by frame; animating them instead held a
// throttled CPU at 18fps for half a second after each toggle.
export const CHART_MOTION = motion({
  transition: { type: "tween", duration: 450, easing: "ease-out" },
});

let measureContext: CanvasRenderingContext2D | null | undefined;
const measureCache = new Map<string, ChartTextMetrics>();

// The host's own measurer re-reads getComputedStyle before every responsive relayout, which
// forces a style recalculation on each frame of the sidebar slide. The host already resolves
// the font into the options, so measuring through a canvas needs no style reads.
export const measureChartText: ChartTextMeasurer = (text, options) => {
  const key = [
    options.fontFamily,
    options.fontStyle,
    options.fontStretch,
    options.fontWeight,
    options.fontSize,
    options.fontScale,
    options.letterSpacing,
    options.direction,
    options.anchor,
    options.baseline,
    text,
  ].join("\0");
  const cached = measureCache.get(key);
  if (cached) return cached;

  measureContext ??= document.createElement("canvas").getContext("2d");
  const fontSize = options.fontSize * (options.fontScale > 0 ? options.fontScale : 1);
  const metrics = measureContext
    ? paintedBounds(measureContext, text, options, fontSize)
    : estimateBounds(text, options, fontSize);
  measureCache.set(key, metrics);
  return metrics;
};

function paintedBounds(
  context: CanvasRenderingContext2D,
  text: string,
  options: Parameters<ChartTextMeasurer>[1],
  fontSize: number
): ChartTextMetrics {
  context.font = `${options.fontStyle} ${options.fontWeight ?? 400} ${fontSize}px ${options.fontFamily}`;
  context.fontStretch = options.fontStretch as CanvasFontStretch;
  context.letterSpacing = `${options.letterSpacing * (options.fontScale || 1)}px`;
  context.textAlign = options.anchor === "middle" ? "center" : options.anchor;
  context.textBaseline = options.baseline === "auto" ? "alphabetic" : options.baseline;
  context.direction = options.direction;
  const measured = context.measureText(text);
  const { actualBoundingBoxLeft: left, actualBoundingBoxRight: right } = measured;
  const { actualBoundingBoxAscent: ascent, actualBoundingBoxDescent: descent } = measured;
  if (left + right > 0 && ascent + descent > 0) {
    return { x: -left, y: -ascent, width: left + right, height: ascent + descent };
  }
  return estimateBounds(text, options, fontSize, measured.width);
}

function estimateBounds(
  text: string,
  options: Parameters<ChartTextMeasurer>[1],
  fontSize: number,
  width = text.length * fontSize * 0.6
): ChartTextMetrics {
  const x = options.anchor === "middle" ? -width / 2 : options.anchor === "end" ? -width : 0;
  const y =
    options.baseline === "middle"
      ? -fontSize / 2
      : options.baseline === "hanging"
        ? 0
        : -fontSize * 0.8;
  return { x, y, width, height: fontSize };
}
