import * as React from "react";
import type { RowData } from "@tanstack/react-table";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
} from "lucide-react";

import { Button } from "@/shared/ui/shadcn/button.tsx";
import { Select, SelectGroup, SelectItem, SelectTrigger } from "@/shared/ui/shadcn/select.tsx";
import { FitSelectContent } from "@/shared/ui/FitSelectContent.tsx";
import { SelectDisplayValue } from "@/shared/ui/SelectDisplayValue.tsx";
import { DEFAULT_PAGE_SIZE, type DataTableInstance } from "@/shared/lib/table.ts";
import { cn } from "@/shared/lib/class-names.ts";

const DEFAULT_PAGE_SIZE_OPTIONS = [DEFAULT_PAGE_SIZE, 250, 500];

interface DataTablePaginationProps<TData extends RowData> {
  table: DataTableInstance<TData>;
  pageSizeOptions?: number[];
  className?: string;
}

export function DataTablePagination<TData extends RowData>({
  table,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  className,
}: DataTablePaginationProps<TData>) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 border-t p-3 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-4 sm:justify-end lg:gap-8">
        <div className="flex items-center gap-2">
          <Select
            value={`${table.state.pagination.pageSize}`}
            onValueChange={(value) => {
              table.setPageSize(Number(value));
            }}
          >
            <SelectTrigger>
              <SelectDisplayValue
                placeholder={table.state.pagination.pageSize}
                options={pageSizeOptions.map((pageSize) => ({
                  value: `${pageSize}`,
                  label: pageSize,
                }))}
              />
            </SelectTrigger>
            <FitSelectContent side="top">
              <SelectGroup>
                {pageSizeOptions.map((pageSize) => (
                  <SelectItem key={pageSize} value={`${pageSize}`}>
                    {pageSize}
                  </SelectItem>
                ))}
              </SelectGroup>
            </FitSelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-center text-sm font-medium sm:w-25">
          {table.state.pagination.pageIndex + 1}
          {"/"}
          {Math.max(1, table.getPageCount())}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="hidden size-8 p-0 lg:flex"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
          >
            <span className="sr-only">Go to first page</span>
            <ChevronsLeftIcon className="size-4" />
          </Button>
          <Button
            variant="outline"
            className="size-8 p-0"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <span className="sr-only">Go to previous page</span>
            <ChevronLeftIcon className="size-4" />
          </Button>
          <Button
            variant="outline"
            className="size-8 p-0"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <span className="sr-only">Go to next page</span>
            <ChevronRightIcon className="size-4" />
          </Button>
          <Button
            variant="outline"
            className="hidden size-8 p-0 lg:flex"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
          >
            <span className="sr-only">Go to last page</span>
            <ChevronsRightIcon className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
