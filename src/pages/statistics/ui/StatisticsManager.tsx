import { useMessages } from "@/shared/i18n/messages.ts";
import { appLocale } from "@/shared/lib/locale.ts";
import { formatInteger } from "@/shared/lib/number-format.ts";
import { PageHeader } from "@/shared/ui/PageHeader.tsx";
import { ChartCard } from "@/pages/statistics/ui/ChartCard.tsx";
import { KpiCard } from "@/pages/statistics/ui/KpiCard.tsx";
import { RangePicker } from "@/pages/statistics/ui/RangePicker.tsx";
import type { DateRange } from "@/pages/statistics/model/date-range.ts";
import { useStatisticsManager } from "@/pages/statistics/model/use-statistics-manager.ts";
import {
  DueForecastChart,
  ReviewsChart,
  StabilityChart,
} from "@/pages/statistics/ui/lazy-charts.ts";

function formatPercent(share: number): string {
  return share.toLocaleString(appLocale(), { style: "percent", maximumFractionDigits: 0 });
}

interface StatisticsManagerProps {
  range: DateRange;
  onRangeChange: (range: DateRange) => void;
}

function StatisticsManager(props: StatisticsManagerProps) {
  const m = useMessages();
  const statistics = useStatisticsManager(() => props.range);
  const figure = (value: number | undefined) => (value === undefined ? "—" : formatInteger(value));
  const retention = () => {
    const share = statistics.statistics?.retention;
    return share === null || share === undefined ? "—" : formatPercent(share);
  };

  return (
    <>
      <PageHeader
        title={m.statistics.title}
        action={<RangePicker value={props.range} onChange={props.onRangeChange} />}
      />

      <div class="-m-1 flex min-h-0 flex-col gap-4 overflow-y-auto p-1 scroll-fade">
        <div class="grid shrink-0 grid-cols-2 gap-2 xl:grid-cols-4">
          <KpiCard
            label={m.statistics.known}
            value={figure(statistics.statistics?.counts.known)}
            isLoading={statistics.isLoading}
          />
          <KpiCard
            label={m.statistics.learning}
            value={figure(statistics.statistics?.counts.learning)}
            isLoading={statistics.isLoading}
          />
          <KpiCard
            label={m.statistics.retention}
            value={retention()}
            isLoading={statistics.isLoading}
          />
          <KpiCard
            label={m.statistics.streak}
            value={figure(statistics.statistics?.streak)}
            unit={m.statistics.days(statistics.statistics?.streak ?? 0)}
            isLoading={statistics.isLoading}
          />
        </div>

        <ChartCard
          title={m.statistics.reviewsTitle}
          description={m.statistics.reviewsDescription}
          class="min-h-80"
          isEmpty={statistics.reviewCount === 0}
          emptyMessage={m.statistics.noReviews}
          isLoading={statistics.isLoading}
          isError={statistics.isError}
          onRetry={statistics.retry}
        >
          <ReviewsChart data={statistics.statistics?.reviewsPerDay ?? []} />
        </ChartCard>

        <div class="grid shrink-0 gap-4 lg:grid-cols-2">
          <ChartCard
            title={m.statistics.forecastTitle}
            description={m.statistics.forecastDescription}
            isEmpty={!statistics.statistics?.dueForecast.some((day) => day.count > 0)}
            emptyMessage={m.statistics.noneDue}
            isLoading={statistics.isLoading}
            isError={statistics.isError}
            onRetry={statistics.retry}
          >
            <DueForecastChart data={statistics.statistics?.dueForecast ?? []} />
          </ChartCard>
          <ChartCard
            title={m.statistics.stabilityTitle}
            description={m.statistics.stabilityDescription}
            isEmpty={!statistics.statistics?.stability.some((bucket) => bucket.count > 0)}
            emptyMessage={m.statistics.noStability}
            isLoading={statistics.isLoading}
            isError={statistics.isError}
            onRetry={statistics.retry}
          >
            <StabilityChart data={statistics.statistics?.stability ?? []} />
          </ChartCard>
        </div>
      </div>
    </>
  );
}

export default StatisticsManager;
