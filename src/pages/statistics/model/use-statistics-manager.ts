import { useQuery } from "@tanstack/react-query";
import { statisticsQuery } from "@/shared/api/queries.ts";
import { useMessages } from "@/shared/i18n/messages.ts";
import { useQueryErrorToast } from "@/shared/lib/use-query-error-toast.ts";

export const RANGES = [7, 30, 90, 365] as const;
export type Range = (typeof RANGES)[number];
export const DEFAULT_RANGE: Range = 30;

export function useStatisticsManager(days: Range) {
  const m = useMessages();
  const statistics = useQuery({
    ...statisticsQuery(days),
    placeholderData: (previous) => previous,
  });
  useQueryErrorToast(statistics.error ? m.statistics.loadFailed : null, "statistics-query");

  const data = statistics.data;
  return {
    statistics: data,
    isLoading: statistics.isLoading,
    isError: statistics.isError,
    retry: () => void statistics.refetch(),
    reviewCount:
      data?.reviewsPerDay.reduce(
        (sum, day) => sum + day.again + day.hard + day.good + day.easy,
        0
      ) ?? 0,
  };
}
