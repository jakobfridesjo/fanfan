import type { ColumnFiltersState, SortingState } from "@tanstack/table-core";
import * as z from "zod/mini";
import { useHistoryState } from "@/shared/lib/use-history-state.ts";

const SortingSchema = z.array(z.object({ id: z.string(), desc: z.boolean() }));
const ColumnFiltersSchema = z.array(z.object({ id: z.string(), value: z.unknown() }));

/** Spread into `useDataTable` to keep a table's search, filters and sorting across Back navigation. */
export function useTableViewState(
  key: string,
  initial: {
    sorting?: SortingState;
    columnFilters?: ColumnFiltersState | (() => ColumnFiltersState);
  } = {}
) {
  const [sorting, onSortingChange] = useHistoryState<SortingState>(
    `${key}.sorting`,
    SortingSchema,
    initial.sorting ?? []
  );
  const [columnFilters, onColumnFiltersChange] = useHistoryState<ColumnFiltersState>(
    `${key}.columnFilters`,
    ColumnFiltersSchema,
    initial.columnFilters ?? []
  );
  const [globalFilter, onGlobalFilterChange] = useHistoryState(
    `${key}.globalFilter`,
    z.string(),
    ""
  );

  return {
    state: {
      get sorting() {
        return sorting();
      },
      get columnFilters() {
        return columnFilters();
      },
      get globalFilter() {
        return globalFilter();
      },
    },
    onSortingChange,
    onColumnFiltersChange,
    onGlobalFilterChange,
  };
}
