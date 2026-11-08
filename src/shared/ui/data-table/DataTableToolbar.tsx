import * as React from "react";
import type { RowData } from "@tanstack/react-table";
import { SlidersHorizontalIcon, XIcon } from "lucide-react";

import { Badge } from "@/shared/ui/shadcn/badge.tsx";
import { Button } from "@/shared/ui/shadcn/button.tsx";
import { DebouncedSearchInput } from "@/shared/ui/DebouncedSearchInput.tsx";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/shared/ui/shadcn/sheet.tsx";
import type { DataTableInstance } from "@/shared/lib/table.ts";
import { useIsMobile } from "@/shared/lib/use-mobile.ts";

interface DataTableToolbarProps<TData extends RowData> {
  table: DataTableInstance<TData>;
  children?: React.ReactNode;
  filters?: React.ReactNode;
  actions?: React.ReactNode;
  /** Renders a debounced search box bound to the table's global filter. */
  searchPlaceholder?: string;
  mobileFiltersTitle?: string;
  mobileFiltersVariant?: "sheet" | "inline";
}

export function DataTableToolbar<TData extends RowData>({
  table,
  children,
  filters,
  actions,
  searchPlaceholder,
  mobileFiltersTitle = "Filters",
  mobileFiltersVariant = "sheet",
}: DataTableToolbarProps<TData>) {
  const isMobile = useIsMobile();
  const [mobileFiltersOpen, setMobileFiltersOpen] = React.useState(false);
  const isFiltered = table.state.columnFilters.length > 0 || !!table.state.globalFilter;
  const activeFilterCount = table.state.columnFilters.length;
  const hasFilters = React.Children.count(filters) > 0;

  if (!isMobile && mobileFiltersOpen) {
    setMobileFiltersOpen(false);
  }

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
        {hasFilters && !isMobile && filters}
        {hasFilters && isMobile && mobileFiltersVariant === "inline" && (
          <div className="flex w-full flex-col gap-2">{filters}</div>
        )}
        {hasFilters && isMobile && mobileFiltersVariant === "sheet" && (
          <>
            <Button
              variant="outline"
              className="border-dashed"
              onClick={() => setMobileFiltersOpen(true)}
            >
              <SlidersHorizontalIcon data-icon="inline-start" />
              {mobileFiltersTitle}
              {activeFilterCount > 0 && <Badge variant="secondary">{activeFilterCount}</Badge>}
            </Button>

            <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
              <SheetContent
                side="bottom"
                className="max-h-[85vh] rounded-t-2xl *:data-[slot=sheet-close]:top-3.5 *:data-[slot=sheet-close]:right-3.5"
              >
                <SheetHeader className="border-b py-4">
                  <SheetTitle>{mobileFiltersTitle}</SheetTitle>
                  <SheetDescription>
                    Refine the table results with additional filters.
                  </SheetDescription>
                </SheetHeader>
                <div className="flex flex-col gap-3 overflow-y-auto p-6 *:data-[slot='select-trigger']:w-full **:data-[slot='select-trigger']:w-full">
                  {filters}
                </div>
              </SheetContent>
            </Sheet>
          </>
        )}
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
