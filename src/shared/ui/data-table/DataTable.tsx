import * as React from "react";
import { flexRender, type RowData } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";

import { Table, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/shadcn/table.tsx";
import { Skeleton } from "@/shared/ui/shadcn/skeleton.tsx";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/shadcn/tooltip.tsx";
import { DataTableColumnHeader } from "@/shared/ui/data-table/DataTableColumnHeader.tsx";
import { DataTableCard, DataTableCardSkeletons } from "@/shared/ui/data-table/DataTableCards.tsx";
import { useIsMobile } from "@/shared/lib/use-mobile.ts";
import type { DataTableCell, DataTableInstance, DataTableRow } from "@/shared/lib/table.ts";
import { cn } from "@/shared/lib/class-names.ts";

const ESTIMATED_ROW_HEIGHT = 49;
const ESTIMATED_CARD_HEIGHT = 150;
const MIN_FLEXIBLE_COLUMN_WIDTH = "12rem";

/** Room for every fixed column plus a minimum for each column without a width. */
function tableMinWidth(widths: (string | undefined)[]) {
  const terms = widths.map((width) => width ?? MIN_FLEXIBLE_COLUMN_WIDTH);
  return `calc(${terms.join(" + ")})`;
}

interface DataTableProps<TData extends RowData> {
  table: DataTableInstance<TData>;
  /** The table scrolls itself, rendering only the rows in view: give it a bounded height. */
  className?: string;
  isLoading?: boolean;
  skeletonRowCount?: number;
  emptyStateMessage?: React.ReactNode;
}

/** The rows in and near view of `scrollRef`, with the space taken by those above and below. */
function useVirtualRows<TData extends RowData>(
  rows: DataTableRow<TData>[],
  estimatedHeight: number
) {
  "use no memo";
  const scrollRef = React.useRef<HTMLDivElement>(null);
  // oxlint-disable-next-line react/incompatible-library -- "use no memo" above, and callers get only fresh values and the stable measureElement
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimatedHeight,
    getItemKey: (index) => rows[index]?.id ?? index,
    overscan: 10,
    useFlushSync: false,
  });
  const items = virtualizer.getVirtualItems();
  const last = items.at(-1);

  return {
    scrollRef,
    measureElement: virtualizer.measureElement,
    visible: items.flatMap((item) => {
      const row = rows[item.index];
      return row ? [{ index: item.index, row }] : [];
    }),
    spaceBefore: items[0]?.start ?? 0,
    spaceAfter: last ? virtualizer.getTotalSize() - last.end : 0,
  };
}

export function DataTable<TData extends RowData>(props: DataTableProps<TData>) {
  const isMobile = useIsMobile();
  return isMobile ? <DataTableCardList {...props} /> : <DataTableGrid {...props} />;
}

function DataTableCardList<TData extends RowData>({
  table,
  className,
  isLoading = false,
  skeletonRowCount = 20,
  emptyStateMessage = "No results.",
}: DataTableProps<TData>) {
  const rows = table.getRowModel().rows;
  const { scrollRef, measureElement, visible, spaceBefore, spaceAfter } = useVirtualRows(
    rows,
    ESTIMATED_CARD_HEIGHT
  );

  return (
    <div ref={scrollRef} className={cn("overflow-auto", className)}>
      {isLoading ? (
        <DataTableCardSkeletons rowCount={skeletonRowCount} />
      ) : rows.length === 0 ? (
        <div className="flex min-h-24 items-center justify-center px-2 py-6 text-center text-muted-foreground">
          {emptyStateMessage}
        </div>
      ) : (
        <div>
          {spaceBefore > 0 && <div aria-hidden style={{ height: spaceBefore }} />}
          {visible.map(({ index, row }) => (
            <DataTableCard
              key={row.id}
              ref={measureElement}
              index={index}
              cells={row.getVisibleCells()}
            />
          ))}
          {spaceAfter > 0 && <div aria-hidden style={{ height: spaceAfter }} />}
        </div>
      )}
    </div>
  );
}

function DataTableGrid<TData extends RowData>({
  table,
  className,
  isLoading = false,
  skeletonRowCount = 20,
  emptyStateMessage = "No results.",
}: DataTableProps<TData>) {
  const rows = table.getRowModel().rows;
  const visibleColumns = table.getVisibleLeafColumns();
  const { scrollRef, measureElement, visible, spaceBefore, spaceAfter } = useVirtualRows(
    rows,
    ESTIMATED_ROW_HEIGHT
  );

  const spacer = (height: number) =>
    height > 0 && (
      <tbody aria-hidden>
        <tr style={{ height }} />
      </tbody>
    );

  return (
    <div
      ref={scrollRef}
      className={cn("overflow-auto *:data-[slot=table-container]:overflow-visible", className)}
    >
      {/* Fixed layout: widths come from the header, not from whichever rows are rendered. */}
      <Table
        className="table-fixed"
        style={{
          minWidth: tableMinWidth(visibleColumns.map((column) => column.columnDef.meta?.width)),
        }}
      >
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const { header: headerDef, meta } = header.column.columnDef;
                const content = header.isPlaceholder ? null : typeof headerDef === "string" ? (
                  <DataTableColumnHeader
                    column={header.column}
                    title={headerDef}
                    className={meta?.align === "center" ? "flex w-full justify-center" : undefined}
                  />
                ) : (
                  flexRender(headerDef, header.getContext())
                );

                return (
                  <TableHead
                    key={header.id}
                    colSpan={header.colSpan}
                    style={{ width: meta?.width }}
                    className={cn(meta?.align === "center" && "text-center")}
                  >
                    {content && meta?.tooltip ? (
                      <Tooltip>
                        <TooltipTrigger render={<div className="inline-flex" />}>
                          {content}
                        </TooltipTrigger>
                        <TooltipContent>{meta.tooltip}</TooltipContent>
                      </Tooltip>
                    ) : (
                      content
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        {isLoading ? (
          <tbody>
            {Array.from({ length: skeletonRowCount }).map((_, i) => (
              // oxlint-disable-next-line react/no-array-index-key -- static placeholders, never reordered
              <TableRow key={`skeleton-${i}`}>
                {visibleColumns.map((column) => (
                  <TableCell key={column.id} className="h-12">
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </tbody>
        ) : rows.length ? (
          <>
            {spacer(spaceBefore)}
            {visible.map(({ index, row }) => (
              <DataTableGridRow
                key={row.id}
                ref={measureElement}
                index={index}
                cells={row.getVisibleCells()}
              />
            ))}
            {spacer(spaceAfter)}
          </>
        ) : (
          <tbody>
            <TableRow className="border-0">
              <TableCell
                colSpan={visibleColumns.length}
                className="h-24 text-center text-muted-foreground"
              >
                {emptyStateMessage}
              </TableCell>
            </TableRow>
          </tbody>
        )}
      </Table>
    </div>
  );
}

interface DataTableGridRowProps<TData extends RowData> {
  ref: React.Ref<HTMLTableSectionElement>;
  index: number;
  /** Passed in, not read from the row, whose identity outlives its state. */
  cells: DataTableCell<TData>[];
}

/** Memoized, so scrolling renders only the rows that come into view. */
const DataTableGridRow = React.memo(function DataTableGridRow<TData extends RowData>({
  ref,
  index,
  cells,
}: DataTableGridRowProps<TData>) {
  return (
    <tbody ref={ref} data-index={index} className="last:[&>tr:last-child]:border-0">
      <TableRow>
        {cells.map((cell) => (
          <TableCell
            key={cell.id}
            className={cn(
              "h-12",
              !cell.column.columnDef.meta?.actions && "truncate",
              cell.column.columnDef.meta?.primary && "font-medium",
              cell.column.columnDef.meta?.align === "center" && "text-center"
            )}
          >
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </TableCell>
        ))}
      </TableRow>
    </tbody>
  );
}) as <TData extends RowData>(props: DataTableGridRowProps<TData>) => React.ReactNode;
