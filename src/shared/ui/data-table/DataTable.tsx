import * as React from "react";
import { flexRender, type RowData } from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/shadcn/table.tsx";
import { Skeleton } from "@/shared/ui/shadcn/skeleton.tsx";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/shadcn/tooltip.tsx";
import { DataTableColumnHeader } from "@/shared/ui/data-table/DataTableColumnHeader.tsx";
import {
  CLICKABLE_ROW_CLASSNAME,
  DataTableCards,
  DataTableCardSkeletons,
} from "@/shared/ui/data-table/DataTableCards.tsx";
import { useIsMobile } from "@/shared/lib/use-mobile.ts";
import { clickableRowProps, type DataTableInstance } from "@/shared/lib/table.ts";
import { cn } from "@/shared/lib/class-names.ts";

interface DataTableProps<TData extends RowData> {
  table: DataTableInstance<TData>;
  layout?: "table" | "cards";
  isLoading?: boolean;
  skeletonRowCount?: number;
  emptyStateMessage?: React.ReactNode;
  onRowClick?: (row: TData) => void;
  getRowClassName?: (row: TData) => string;
  /** Needs `getRowCanExpand` on the table and a cell that calls `row.getToggleExpandedHandler()`. */
  renderSubRow?: (row: TData) => React.ReactNode;
}

export function DataTable<TData extends RowData>({
  table,
  layout = "table",
  isLoading = false,
  skeletonRowCount = 20,
  emptyStateMessage = "No results.",
  onRowClick,
  getRowClassName,
  renderSubRow,
}: DataTableProps<TData>) {
  const isMobile = useIsMobile();
  const useCardLayout = layout === "cards" || isMobile;
  const rows = table.getRowModel().rows;
  const isEmpty = rows.length === 0;
  const visibleColumns = table.getVisibleLeafColumns();

  if (useCardLayout) {
    return (
      <div className="overflow-hidden">
        {isLoading ? (
          <DataTableCardSkeletons rowCount={skeletonRowCount} />
        ) : isEmpty ? (
          <div className="flex min-h-24 items-center justify-center px-2 py-6 text-center text-muted-foreground">
            {emptyStateMessage}
          </div>
        ) : (
          <DataTableCards
            rows={rows}
            onRowClick={onRowClick}
            getRowClassName={getRowClassName}
            renderSubRow={renderSubRow}
          />
        )}
      </div>
    );
  }

  return (
    <div className="*:data-[slot=table-container]:overflow-visible">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-card backdrop-blur-md">
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
                    className={cn(
                      meta?.align === "center" && "text-center",
                      meta?.actions && "w-0"
                    )}
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
        <TableBody>
          {isLoading ? (
            Array.from({ length: skeletonRowCount }).map((_, i) => (
              // oxlint-disable-next-line react/no-array-index-key -- static placeholders, never reordered
              <TableRow key={`skeleton-${i}`}>
                {visibleColumns.map((column) => (
                  <TableCell key={column.id} className="h-12">
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : rows.length ? (
            rows.map((row) => (
              <React.Fragment key={row.id}>
                <TableRow
                  data-state={row.getIsSelected() && "selected"}
                  {...clickableRowProps(onRowClick, row.original)}
                  className={cn(
                    onRowClick && CLICKABLE_ROW_CLASSNAME,
                    getRowClassName?.(row.original)
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        "h-12",
                        cell.column.columnDef.meta?.primary && "font-medium",
                        cell.column.columnDef.meta?.align === "center" && "text-center"
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
                {renderSubRow && row.getIsExpanded() && (
                  <TableRow className="hover:bg-transparent!">
                    <TableCell colSpan={visibleColumns.length} className="bg-muted/30">
                      {renderSubRow(row.original)}
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={visibleColumns.length}
                className="h-24 text-center text-muted-foreground"
              >
                {emptyStateMessage}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
