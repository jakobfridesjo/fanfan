import { createMemo } from "solid-js";
import type { Statistics } from "@/shared/api/commands.ts";
import { statisticsQuery, useCommandQuery } from "@/shared/api/queries.ts";
import { useMessages } from "@/shared/i18n/messages.ts";
import { useQueryErrorToast } from "@/shared/lib/use-query-error-toast.ts";
import type { DateRange } from "@/pages/statistics/model/date-range.ts";

export function useStatisticsManager(range: () => DateRange) {
  const m = useMessages();
  const query = useCommandQuery(() => statisticsQuery(range().from, range().to));
  useQueryErrorToast(() => (query.isError ? m.statistics.loadFailed : null), "statistics-query");

  // The last range's figures stay on show while another range loads.
  const statistics = createMemo<Statistics | undefined>((shown) => query.data ?? shown);

  return {
    get statistics() {
      return statistics();
    },
    get isLoading() {
      return query.isLoading && statistics() === undefined;
    },
    get isError() {
      return query.isError;
    },
    retry: () => void query.refetch(),
    get reviewCount() {
      return (
        statistics()?.reviewsPerDay.reduce(
          (sum, day) => sum + day.again + day.hard + day.good + day.easy,
          0
        ) ?? 0
      );
    },
  };
}
