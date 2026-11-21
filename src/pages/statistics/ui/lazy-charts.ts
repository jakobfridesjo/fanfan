import { lazy } from "solid-js";

// The chart library loads with the first chart, not with the page.

export const ReviewsChart = lazy(() => import("@/pages/statistics/ui/ReviewsChart.tsx"));

export const DueForecastChart = lazy(() => import("@/pages/statistics/ui/DueForecastChart.tsx"));

export const StabilityChart = lazy(() => import("@/pages/statistics/ui/StabilityChart.tsx"));
