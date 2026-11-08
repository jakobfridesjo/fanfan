import type { ReactNode } from "react";
import { flexRender, type RowData } from "@tanstack/react-table";
import { Skeleton } from "@/shared/ui/shadcn/skeleton.tsx";
import { clickableRowProps, type DataTableRow } from "@/shared/lib/table.ts";
import { cn } from "@/shared/lib/class-names.ts";

export const CLICKABLE_ROW_CLASSNAME =
  "cursor-pointer transition-colors outline-none focus-visible:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset";

function titleCellOf<TData extends RowData>(row: DataTableRow<TData>) {
  const visibleCells = row.getVisibleCells();

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

function DataTableCard<TData extends RowData>({
  row,
  onRowClick,
  getRowClassName,
  renderSubRow,
}: {
  row: DataTableRow<TData>;
  onRowClick?: (row: TData) => void;
  getRowClassName?: (row: TData) => string;
  renderSubRow?: (row: TData) => ReactNode;
}) {
  const titleCell = titleCellOf(row);
  const visibleCells = row
    .getVisibleCells()
    .filter((cell) => !cell.column.columnDef.meta?.mobileHidden);
  const actionCells = visibleCells.filter((cell) => cell.column.columnDef.meta?.actions);
  const detailCells = visibleCells.filter(
    (cell) => cell.id !== titleCell?.id && !cell.column.columnDef.meta?.actions
  );

  return (
    <div
      data-state={row.getIsSelected() && "selected"}
      {...clickableRowProps(onRowClick, row.original)}
      className={cn(
        "border-b p-2 transition-colors data-[state=selected]:bg-muted last:border-b-0 hover:bg-muted/50",
        onRowClick && CLICKABLE_ROW_CLASSNAME,
        getRowClassName?.(row.original)
      )}
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

      {renderSubRow && row.getIsExpanded() && (
        <div className="mt-2 border-t pt-2">{renderSubRow(row.original)}</div>
      )}

      {detailCells.length > 0 && (
        <div className="space-y-2">
          {detailCells.map((cell) => {
            const { header, meta } = cell.column.columnDef;
            const label =
              meta?.mobileLabel ?? (typeof header === "string" ? header : cell.column.id);

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
}

export function DataTableCards<TData extends RowData>({
  rows,
  onRowClick,
  getRowClassName,
  renderSubRow,
}: {
  rows: DataTableRow<TData>[];
  onRowClick?: (row: TData) => void;
  getRowClassName?: (row: TData) => string;
  renderSubRow?: (row: TData) => ReactNode;
}) {
  return (
    <div>
      {rows.map((row) => (
        <DataTableCard
          key={row.id}
          row={row}
          onRowClick={onRowClick}
          getRowClassName={getRowClassName}
          renderSubRow={renderSubRow}
        />
      ))}
    </div>
  );
}
