import { PageHeader } from "@/shared/ui/PageHeader.tsx";
import { Card } from "@/shared/ui/shadcn/card.tsx";
import { Skeleton } from "@/shared/ui/shadcn/skeleton.tsx";
import { cn } from "@/shared/lib/class-names.ts";

const TABLE_ROW_WIDTHS = ["w-3/4", "w-1/2", "w-2/3", "w-4/5", "w-3/5", "w-1/2"];
const WORKSPACE_FIELD_WIDTHS = ["w-full", "w-4/5", "w-full", "w-2/3"];

interface PageLoadingSkeletonProps {
  title: string;
  layout?: "table" | "workspace";
  onBack?: () => void;
}

function TableSkeleton() {
  return (
    <Card className="min-h-0 grow gap-0 py-0">
      <div className="flex items-center justify-between gap-3 border-b p-3">
        <Skeleton className="h-8 w-full max-w-64 motion-reduce:animate-none" />
        <Skeleton className="size-8 shrink-0 motion-reduce:animate-none" />
      </div>
      <div className="grid grid-cols-[minmax(8rem,2fr)_repeat(3,minmax(5rem,1fr))] gap-6 bg-muted/30 px-4 py-3">
        {Array.from({ length: 4 }, (_, index) => (
          // oxlint-disable-next-line react/no-array-index-key -- static placeholders, never reordered
          <Skeleton key={index} className="h-3 w-2/3 motion-reduce:animate-none" />
        ))}
      </div>
      <div className="min-h-0 grow overflow-hidden">
        {TABLE_ROW_WIDTHS.map((width, index) => (
          <div
            // oxlint-disable-next-line react/no-array-index-key -- static placeholders, never reordered
            key={index}
            className="grid grid-cols-[minmax(8rem,2fr)_repeat(3,minmax(5rem,1fr))] gap-6 border-t px-4 py-4 first:border-t-0"
          >
            <Skeleton className={cn("h-4 motion-reduce:animate-none", width)} />
            <Skeleton className="h-4 w-3/4 motion-reduce:animate-none" />
            <Skeleton className="h-4 w-2/3 motion-reduce:animate-none" />
            <Skeleton className="h-4 w-1/2 motion-reduce:animate-none" />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-4 border-t px-4 py-3">
        <Skeleton className="h-4 w-28 motion-reduce:animate-none" />
        <Skeleton className="h-8 w-36 motion-reduce:animate-none" />
      </div>
    </Card>
  );
}

function WorkspacePanel({ secondary = false }: { secondary?: boolean }) {
  return (
    <Card size="sm" className="min-h-64 gap-0 px-4">
      <div className="mb-5 flex items-center justify-between gap-3">
        <Skeleton className="h-5 w-32 motion-reduce:animate-none" />
        <Skeleton className="h-8 w-24 motion-reduce:animate-none" />
      </div>
      {secondary ? (
        <Skeleton className="min-h-48 grow w-full motion-reduce:animate-none" />
      ) : (
        <div className="flex flex-col gap-5">
          {WORKSPACE_FIELD_WIDTHS.map((width, index) => (
            // oxlint-disable-next-line react/no-array-index-key -- static placeholders, never reordered
            <div key={index} className="flex flex-col gap-2">
              <Skeleton className="h-3 w-24 motion-reduce:animate-none" />
              <Skeleton className={cn("h-9 motion-reduce:animate-none", width)} />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export function PageLoadingSkeleton({ title, layout = "table", onBack }: PageLoadingSkeletonProps) {
  return (
    <div
      className="flex min-h-0 grow flex-col"
      role="status"
      aria-label={`Loading ${title}`}
      aria-live="polite"
    >
      <PageHeader title={title} onBack={onBack} />
      {layout === "table" ? (
        <TableSkeleton />
      ) : (
        <div className="grid min-h-0 grow gap-2 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <WorkspacePanel />
          <WorkspacePanel secondary />
        </div>
      )}
    </div>
  );
}
