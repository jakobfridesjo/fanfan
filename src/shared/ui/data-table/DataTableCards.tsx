import { memo, type ReactNode, type Ref } from "react";
import { flexRender, type RowData } from "@tanstack/react-table";
import { Skeleton } from "@/shared/ui/shadcn/skeleton.tsx";
import type { DataTableCell } from "@/shared/lib/table.ts";
import { cn } from "@/shared/lib/class-names.ts";

function titleCellOf<TData extends RowData>(visibleCells: DataTableCell<TData>[]) {
  return (
    visibleCells.find((cell) => cell.column.columnDef.meta?.primary) ??
    visibleCells.find((cell) => !cell.column.columnDef.meta?.actions) ??
    visibleCells[0]
  );
}

export function DataTableCardSkeletons({ rowCount }: { rowCount: number }) {
  return (
    <div>
      {Array.from({ length: rowCount }).map((_, index) => (
        // oxlint-disable-next-line react/no-array-index-key -- static placeholders, never reordered
        <div key={`mobile-skeleton-${index}`} className="border-b p-2 last:border-b-0">
          <Skeleton className="mb-3 h-6 w-1/2" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-5/6" />
            <Skeleton className="h-5 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

interface DataTableCardProps<TData extends RowData> {
  ref?: Ref<HTMLDivElement>;
  /** The row's position in the virtualized list, read by `measureElement`. */
  index?: number;
  /** Passed in, not read from the row, whose identity outlives its state. */
  cells: DataTableCell<TData>[];
}

/** Memoized, so scrolling renders only the cards that come into view. */
export const DataTableCard = memo(function DataTableCard<TData extends RowData>({
  ref,
  index,
  cells,
}: DataTableCardProps<TData>) {
  const titleCell = titleCellOf(cells);
  const actionCells = cells.filter((cell) => cell.column.columnDef.meta?.actions);
  const detailCells = cells.filter(
    (cell) => cell.id !== titleCell?.id && !cell.column.columnDef.meta?.actions
  );

  return (
    <div
      ref={ref}
      data-index={index}
      className="border-b p-2 transition-colors last:border-b-0 hover:bg-muted/50"
    >
      {(titleCell || actionCells.length > 0) && (
        <div className="mb-2 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {titleCell && (
              <div className="min-w-0 text-sm font-semibold text-foreground">
                {flexRender(titleCell.column.columnDef.cell, titleCell.getContext())}
              </div>
            )}
          </div>
          {actionCells.length > 0 && (
            <div className="flex shrink-0 items-center gap-1">
              {actionCells.map((cell) => (
                <div key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {detailCells.length > 0 && (
        <div className="space-y-2">
          {detailCells.map((cell) => {
            const { header, meta } = cell.column.columnDef;
            const label = typeof header === "string" ? header : cell.column.id;

            return (
              <div
                key={cell.id}
                className={cn(
                  "flex gap-3",
                  meta?.mobileFullWidth ? "flex-col items-start" : "items-start justify-between"
                )}
              >
                <div className="shrink-0 text-2xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  {label}
                </div>
                <div
                  className={cn(
                    "min-w-0 text-sm text-foreground",
                    !meta?.mobileFullWidth && "text-right"
                  )}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}) as <TData extends RowData>(props: DataTableCardProps<TData>) => ReactNode;
