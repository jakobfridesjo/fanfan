import { noop } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { statisticsQuery } from "@/shared/api/queries.ts";
import { DEFAULT_RANGE } from "@/pages/statistics/model/use-statistics-manager.ts";
import StatisticsManager from "@/pages/statistics/ui/StatisticsManager.tsx";

export const Route = createFileRoute("/_app/statistics")({
  loader: ({ context }) => {
    void context.queryClient.query(statisticsQuery(DEFAULT_RANGE)).catch(noop);
  },
  component: StatisticsManager,
});
