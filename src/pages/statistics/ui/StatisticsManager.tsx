import { useMessages } from "@/shared/i18n/messages.ts";
import { appLocale } from "@/shared/lib/locale.ts";
import { formatInteger } from "@/shared/lib/number-format.ts";
import { PageHeader } from "@/shared/ui/PageHeader.tsx";
import { ChartCard } from "@/shared/ui/charts/ChartCard.tsx";
import { KpiCard } from "@/shared/ui/charts/KpiCard.tsx";
import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/shadcn/toggle-group.tsx";
import {
  RANGES,
  type Range,
  useStatisticsManager,
} from "@/pages/statistics/model/use-statistics-manager.ts";
import {
  DueForecastChart,
  ReviewsChart,
  StabilityChart,
} from "@/pages/statistics/ui/lazy-charts.ts";

function formatPercent(share: number): string {
  return share.toLocaleString(appLocale(), { style: "percent", maximumFractionDigits: 0 });
}

function RangePicker({ value, onChange }: { value: Range; onChange: (range: Range) => void }) {
  const m = useMessages();
  return (
    <ToggleGroup
      aria-label={m.statistics.range}
      variant="outline"
      size="sm"
      value={[String(value)]}
      // Pressing the chosen range again would leave nothing chosen.
      onValueChange={(next) => {
        const chosen = RANGES.find((range) => String(range) === next[0]);
        if (chosen) onChange(chosen);
      }}
    >
      {RANGES.map((range) => (
        <ToggleGroupItem key={range} value={String(range)} className="px-3">
          {m.statistics.ranges[range]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

function StatisticsManager() {
  const m = useMessages();
  const { days, setDays, statistics, isLoading, isError, retry, reviewCount } =
    useStatisticsManager();
  const chartState = { isLoading, isError, onRetry: retry };
  const figure = (value: number | undefined) => (value === undefined ? "—" : formatInteger(value));

  return (
    <>
      <PageHeader title={m.statistics.title}>
        <RangePicker value={days} onChange={setDays} />
      </PageHeader>

      <div className="-m-1 flex min-h-0 flex-col gap-4 overflow-y-auto p-1">
        <div className="grid shrink-0 grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
          <KpiCard
            label={m.statistics.known}
            value={figure(statistics?.counts.known)}
            isLoading={isLoading}
          />
          <KpiCard
            label={m.statistics.learning}
            value={figure(statistics?.counts.learning)}
            isLoading={isLoading}
          />
          <KpiCard
            label={m.statistics.dueNow}
            value={figure(statistics?.counts.due)}
            isLoading={isLoading}
          />
          <KpiCard
            label={m.statistics.reviews}
            value={figure(statistics && reviewCount)}
            unit={m.statistics.ranges[days]}
            isLoading={isLoading}
          />
          <KpiCard
            label={m.statistics.retention}
            value={
              statistics && statistics.retention !== null
                ? formatPercent(statistics.retention)
                : "—"
            }
            isLoading={isLoading}
          />
          <KpiCard
            label={m.statistics.streak}
            value={figure(statistics?.streak)}
            unit={m.statistics.streakDays(statistics?.streak ?? 0)}
            isLoading={isLoading}
          />
        </div>

        <ChartCard
          title={m.statistics.reviewsTitle}
          description={m.statistics.reviewsDescription}
          className="min-h-80"
          isEmpty={reviewCount === 0}
          emptyMessage={m.statistics.noReviews}
          {...chartState}
        >
          <ReviewsChart data={statistics?.reviewsPerDay ?? []} />
        </ChartCard>

        <div className="grid shrink-0 gap-4 lg:grid-cols-2">
          <ChartCard
            title={m.statistics.forecastTitle}
            description={m.statistics.forecastDescription}
            isEmpty={!statistics?.dueForecast.some((day) => day.count > 0)}
            emptyMessage={m.statistics.noneDue}
            {...chartState}
          >
            <DueForecastChart data={statistics?.dueForecast ?? []} />
          </ChartCard>
          <ChartCard
            title={m.statistics.stabilityTitle}
            description={m.statistics.stabilityDescription}
            isEmpty={!statistics?.stability.some((bucket) => bucket.count > 0)}
            emptyMessage={m.statistics.noStability}
            {...chartState}
          >
            <StabilityChart data={statistics?.stability ?? []} />
          </ChartCard>
        </div>
      </div>
    </>
  );
}

export default StatisticsManager;
