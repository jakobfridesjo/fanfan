import { noop } from "@tanstack/solid-query";
import { createFileRoute } from "@tanstack/solid-router";
import * as z from "zod/mini";
import { statisticsQuery } from "@/shared/api/queries.ts";
import { type DateRange, rangeOrDefault } from "@/pages/statistics/model/date-range.ts";
import StatisticsManager from "@/pages/statistics/ui/StatisticsManager.tsx";

const wireDate = z.catch(z.optional(z.string()), undefined);

export const Route = createFileRoute("/_app/statistics")({
  validateSearch: z.object({ from: wireDate, to: wireDate }),
  loaderDeps: ({ search }) => rangeOrDefault(search.from, search.to),
  loader: ({ context, deps }) => {
    void context.queryClient.query(statisticsQuery(deps.from, deps.to)).catch(noop);
  },
  component: StatisticsRoute,
});

function StatisticsRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <StatisticsManager
      range={rangeOrDefault(search().from, search().to)}
      onRangeChange={(next: DateRange) => void navigate({ search: next, replace: true })}
    />
  );
}
