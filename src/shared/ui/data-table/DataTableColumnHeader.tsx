import { type RowData, Subscribe } from "@tanstack/react-table";
import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon } from "lucide-react";

import { cn } from "@/shared/lib/class-names.ts";
import { Button } from "@/shared/ui/shadcn/button.tsx";
import type { DataTableColumn, DataTableInstance } from "@/shared/lib/table.ts";

type SortableColumn = Pick<
  DataTableColumn<RowData>,
  "getCanSort" | "getIsSorted" | "getNextSortingOrder" | "getToggleSortingHandler"
> & { table: { atoms: Pick<DataTableInstance<RowData>["atoms"], "sorting"> } };

interface DataTableColumnHeaderProps {
  column: SortableColumn;
  title: string;
  className?: string;
}

export function DataTableColumnHeader({ column, title, className }: DataTableColumnHeaderProps) {
  if (!column.getCanSort()) {
    return <div className={className}>{title}</div>;
  }

  return (
    <Subscribe source={column.table.atoms.sorting}>
      {() => {
        const nextSortingOrder = column.getNextSortingOrder();
        const sortAction =
          nextSortingOrder === "asc"
            ? "Sort ascending"
            : nextSortingOrder === "desc"
              ? "Sort descending"
              : "Clear sorting";
        const sorted = column.getIsSorted();

        return (
          <div className={cn("flex items-center gap-2", className)}>
            <Button
              variant="ghost"
              className="-ml-3"
              onClick={column.getToggleSortingHandler()}
              aria-label={`${sortAction} by ${title}`}
              title={`${sortAction} by ${title}`}
            >
              <span>{title}</span>
              {sorted === "desc" ? (
                <ArrowDownIcon data-icon="inline-end" />
              ) : sorted === "asc" ? (
                <ArrowUpIcon data-icon="inline-end" />
              ) : (
                <ChevronsUpDownIcon data-icon="inline-end" />
              )}
            </Button>
          </div>
        );
      }}
    </Subscribe>
  );
}
