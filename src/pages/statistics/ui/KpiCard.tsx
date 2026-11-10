import { cn } from "@/shared/lib/class-names.ts";
import { Card, CardContent } from "@/shared/ui/shadcn/card.tsx";
import { Skeleton } from "@/shared/ui/shadcn/skeleton.tsx";

interface KpiCardProps {
  label: string;
  value: string;
  unit?: string;
  isLoading?: boolean;
  className?: string;
}

/** One headline figure: a small caps label over a large number. */
export function KpiCard({ label, value, unit, isLoading, className }: KpiCardProps) {
  return (
    <Card
      size="sm"
      className={cn(
        "shrink-0 outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
        className
      )}
      tabIndex={0}
      role="group"
      aria-label={label}
    >
      <CardContent className="flex flex-col gap-2">
        <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          {label}
        </span>
        {isLoading ? (
          <Skeleton className="h-7 w-16" />
        ) : (
          <div className="flex items-baseline gap-2">
            <span className="text-kpi font-semibold tabular-nums">{value}</span>
            {unit && <span className="text-xs leading-none text-muted-foreground">{unit}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
