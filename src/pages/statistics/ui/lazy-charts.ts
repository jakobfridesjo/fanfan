import { lazy } from "react";

// The chart library loads with the first chart, not with the page.

export const ReviewsChart = lazy(() =>
  import("@/pages/statistics/ui/ReviewsChart.tsx").then((module) => ({
    default: module.ReviewsChart,
  }))
);

export const DueForecastChart = lazy(() =>
  import("@/pages/statistics/ui/DueForecastChart.tsx").then((module) => ({
    default: module.DueForecastChart,
  }))
);

export const StabilityChart = lazy(() =>
  import("@/pages/statistics/ui/StabilityChart.tsx").then((module) => ({
    default: module.StabilityChart,
  }))
);
