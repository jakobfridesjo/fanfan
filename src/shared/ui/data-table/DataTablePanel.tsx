import type { ReactNode } from "react";
import type { RowData } from "@tanstack/react-table";
import { DataTable } from "@/shared/ui/data-table/DataTable.tsx";
import { DataTableToolbar } from "@/shared/ui/data-table/DataTableToolbar.tsx";
import type { DataTableInstance } from "@/shared/lib/table.ts";
import { Card } from "@/shared/ui/shadcn/card.tsx";
import { CenteredEmpty } from "@/shared/ui/EmptyStates.tsx";

interface DataTablePanelProps<TData extends RowData> {
  table: DataTableInstance<TData>;
  children?: ReactNode;
  actions?: ReactNode;
  filters?: ReactNode;
  searchPlaceholder?: string;
  mobileFiltersTitle?: string;
  isLoading?: boolean;
  skeletonRowCount?: number;
  emptyStateMessage?: ReactNode;
  /** Takes the place of the rows, centered in the body, e.g. an `UnavailableState`. The toolbar stays. */
  fallback?: ReactNode;
  onRowClick?: (row: TData) => void;
  getRowClassName?: (row: TData) => string;
  renderSubRow?: (row: TData) => ReactNode;
  /** Draws the panel as a card. Disable when a parent card already frames it. */
  bordered?: boolean;
  /**
   * `page` sets the table straight on the page card, unframed, so it is not a card on a card;
   * a toolbar is better placed in the `PageHeader` then.
   */
  surface?: "card" | "page";
}

export function DataTablePanel<TData extends RowData>({
  table,
  children,
  actions,
  filters,
  searchPlaceholder,
  mobileFiltersTitle,
  isLoading,
  skeletonRowCount,
  emptyStateMessage,
  fallback,
  onRowClick,
  getRowClassName,
  renderSubRow,
  bordered = true,
  surface = "card",
}: DataTablePanelProps<TData>) {
  const hasToolbar = !!(searchPlaceholder || filters || actions || children);
  const onPage = surface === "page";

  const Panel = bordered && !onPage ? Card : "div";

  return (
    <Panel className="flex min-h-0 grow flex-col gap-0 overflow-hidden py-0">
      {hasToolbar && (
        <DataTableToolbar
          table={table}
          actions={actions}
          filters={filters}
          searchPlaceholder={searchPlaceholder}
          mobileFiltersTitle={mobileFiltersTitle}
        >
          {children}
        </DataTableToolbar>
      )}
      {fallback ? (
        <CenteredEmpty className="min-h-0 grow">{fallback}</CenteredEmpty>
      ) : (
        <DataTable
          className="min-h-0 grow"
          table={table}
          isLoading={isLoading}
          skeletonRowCount={skeletonRowCount}
          emptyStateMessage={emptyStateMessage}
          onRowClick={onRowClick}
          getRowClassName={getRowClassName}
          renderSubRow={renderSubRow}
          surface={surface}
        />
      )}
    </Panel>
  );
}
