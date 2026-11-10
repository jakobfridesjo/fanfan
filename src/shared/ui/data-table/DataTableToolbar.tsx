import type * as React from "react";
import type { RowData } from "@tanstack/react-table";
import { XIcon } from "lucide-react";

import { Button } from "@/shared/ui/shadcn/button.tsx";
import { DebouncedSearchInput } from "@/shared/ui/DebouncedSearchInput.tsx";
import type { DataTableInstance } from "@/shared/lib/table.ts";

interface DataTableToolbarProps<TData extends RowData> {
  table: DataTableInstance<TData>;
  children?: React.ReactNode;
  actions?: React.ReactNode;
  /** Renders a debounced search box bound to the table's global filter. */
  searchPlaceholder?: string;
}

export function DataTableToolbar<TData extends RowData>({
  table,
  children,
  actions,
  searchPlaceholder,
}: DataTableToolbarProps<TData>) {
  const isFiltered = table.state.columnFilters.length > 0 || !!table.state.globalFilter;

  const handleReset = () => {
    table.resetColumnFilters();
    table.resetGlobalFilter();
  };

  return (
    <div className="flex items-center justify-between border-b p-3">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        {searchPlaceholder && (
          <DebouncedSearchInput
            placeholder={searchPlaceholder}
            value={typeof table.state.globalFilter === "string" ? table.state.globalFilter : ""}
            onValueChange={(value) => table.setGlobalFilter(value)}
            className="w-full sm:w-60 lg:w-72"
          />
        )}
        {children}
        {isFiltered && (
          <Button variant="ghost" onClick={handleReset} className="text-muted-foreground">
            Reset
            <XIcon data-icon="inline-end" />
          </Button>
        )}
        {actions}
      </div>
    </div>
  );
}
