import { noop } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import * as z from "zod/mini";
import { statisticsQuery } from "@/shared/api/queries.ts";
import {
  DEFAULT_RANGE,
  RANGES,
  type Range,
} from "@/pages/statistics/model/use-statistics-manager.ts";
import StatisticsManager from "@/pages/statistics/ui/StatisticsManager.tsx";

const rangeSchema = z.catch(z._default(z.literal(RANGES), DEFAULT_RANGE), DEFAULT_RANGE);

export const Route = createFileRoute("/_app/statistics")({
  validateSearch: z.object({ days: rangeSchema }),
  loaderDeps: ({ search }) => ({ days: search.days }),
  loader: ({ context, deps }) => {
    void context.queryClient.query(statisticsQuery(deps.days)).catch(noop);
  },
  component: StatisticsRoute,
});

function StatisticsRoute() {
  const { days } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <StatisticsManager
      days={days}
      onDaysChange={(next: Range) => void navigate({ search: { days: next }, replace: true })}
    />
  );
}
