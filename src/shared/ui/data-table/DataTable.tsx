import type { JSX } from "@solidjs/web";
import { For, Match, Show, Switch } from "solid-js";
import type { RowData } from "@tanstack/table-core";

import { Table, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/shadcn/table.tsx";
import { Skeleton } from "@/shared/ui/shadcn/skeleton.tsx";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/shadcn/tooltip.tsx";
import { DataTableColumnHeader } from "@/shared/ui/data-table/DataTableColumnHeader.tsx";
import { DataTableCard, DataTableCardSkeletons } from "@/shared/ui/data-table/DataTableCards.tsx";
import { useMessages } from "@/shared/i18n/messages.ts";
import { useIsMobile } from "@/shared/lib/use-mobile.ts";
import { useVirtualRows } from "@/shared/lib/use-virtual-rows.ts";
import {
  flexRender,
  type DataTableCell,
  type DataTableInstance,
  type DataTableRow,
} from "@/shared/lib/table.ts";
import { cn } from "@/shared/lib/class-names.ts";

const ESTIMATED_ROW_HEIGHT = 49;
const ESTIMATED_CARD_HEIGHT = 150;
const MIN_FLEXIBLE_COLUMN_WIDTH = "12rem";
const DEFAULT_SKELETON_ROWS = 20;

/** Room for every fixed column plus a minimum for each column without a width. */
function tableMinWidth(widths: (string | undefined)[]) {
  const terms = widths.map((width) => width ?? MIN_FLEXIBLE_COLUMN_WIDTH);
  return `calc(${terms.join(" + ")})`;
}

interface DataTableProps<TData extends RowData> {
  table: DataTableInstance<TData>;
  /** The table scrolls itself, rendering only the rows in view: give it a bounded height. */
  class?: string;
  isLoading?: boolean;
  skeletonRowCount?: number;
  emptyStateMessage?: JSX.Element;
}

const rowKey = <TData extends RowData>(entry: { row: DataTableRow<TData> }) => entry.row.id;

export function DataTable<TData extends RowData>(props: DataTableProps<TData>) {
  const isMobile = useIsMobile();
  return (
    <Show when={isMobile()} fallback={<DataTableGrid {...props} />}>
      <DataTableCardList {...props} />
    </Show>
  );
}

function EmptyMessage<TData extends RowData>(props: DataTableProps<TData>) {
  const m = useMessages();
  return <>{props.emptyStateMessage ?? m.table.noResults}</>;
}

function DataTableCardList<TData extends RowData>(props: DataTableProps<TData>) {
  const rows = () => props.table.getRowModel().rows;
  const virtual = useVirtualRows(rows, ESTIMATED_CARD_HEIGHT);

  return (
    <div ref={virtual.scrollRef} class={cn("overflow-auto", props.class)}>
      <Switch>
        <Match when={props.isLoading}>
          <DataTableCardSkeletons rowCount={props.skeletonRowCount ?? DEFAULT_SKELETON_ROWS} />
        </Match>
        <Match when={rows().length === 0}>
          <div class="flex min-h-24 items-center justify-center px-2 py-6 text-center text-muted-foreground">
            <EmptyMessage {...props} />
          </div>
        </Match>
        <Match when={true}>
          <div>
            <div aria-hidden="true" style={{ height: `${virtual.spaceBefore}px` }} />
            <For each={virtual.visible} keyed={rowKey}>
              {(entry) => (
                <DataTableCard
                  measure={virtual.measure}
                  index={entry().index}
                  cells={entry().row.getAllCells()}
                />
              )}
            </For>
            <div aria-hidden="true" style={{ height: `${virtual.spaceAfter}px` }} />
          </div>
        </Match>
      </Switch>
    </div>
  );
}

function Spacer(props: { height: number }) {
  return (
    <Show when={props.height > 0}>
      <tbody aria-hidden="true">
        <tr style={{ height: `${props.height}px` }} />
      </tbody>
    </Show>
  );
}

function DataTableGrid<TData extends RowData>(props: DataTableProps<TData>) {
  const rows = () => props.table.getRowModel().rows;
  const columns = () => props.table.getAllLeafColumns();
  const virtual = useVirtualRows(rows, ESTIMATED_ROW_HEIGHT);

  return (
    <div
      ref={virtual.scrollRef}
      class={cn("overflow-auto *:data-[slot=table-container]:overflow-visible", props.class)}
    >
      {/* Fixed layout: widths come from the header, not from whichever rows are rendered. */}
      <Table
        class="table-fixed"
        style={{
          "min-width": tableMinWidth(columns().map((column) => column.columnDef.meta?.width)),
        }}
      >
        <TableHeader>
          <For each={props.table.getHeaderGroups()}>
            {(headerGroup) => (
              <TableRow>
                <For each={headerGroup.headers}>
                  {(header) => {
                    const { header: headerDef, meta } = header.column.columnDef;
                    const content = () =>
                      header.isPlaceholder ? null : typeof headerDef === "string" ? (
                        <DataTableColumnHeader
                          column={header.column}
                          title={headerDef}
                          class={
                            meta?.align === "center" ? "flex w-full justify-center" : undefined
                          }
                        />
                      ) : (
                        flexRender(headerDef, header.getContext())
                      );

                    return (
                      <TableHead
                        colspan={header.colSpan}
                        style={{ width: meta?.width }}
                        class={cn(meta?.align === "center" && "text-center")}
                      >
                        <Show when={!header.isPlaceholder && meta?.tooltip} fallback={content()}>
                          <Tooltip>
                            <TooltipTrigger as="div" class="inline-flex">
                              {content()}
                            </TooltipTrigger>
                            <TooltipContent>{meta?.tooltip}</TooltipContent>
                          </Tooltip>
                        </Show>
                      </TableHead>
                    );
                  }}
                </For>
              </TableRow>
            )}
          </For>
        </TableHeader>
        <Switch>
          <Match when={props.isLoading}>
            <tbody>
              <For each={Array.from({ length: props.skeletonRowCount ?? DEFAULT_SKELETON_ROWS })}>
                {() => (
                  <TableRow>
                    <For each={columns()}>
                      {() => (
                        <TableCell class="h-12">
                          <Skeleton class="h-6 w-full" />
                        </TableCell>
                      )}
                    </For>
                  </TableRow>
                )}
              </For>
            </tbody>
          </Match>
          <Match when={rows().length > 0}>
            <Spacer height={virtual.spaceBefore} />
            <For each={virtual.visible} keyed={rowKey}>
              {(entry) => (
                <DataTableGridRow
                  measure={virtual.measure}
                  index={entry().index}
                  cells={entry().row.getAllCells()}
                />
              )}
            </For>
            <Spacer height={virtual.spaceAfter} />
          </Match>
          <Match when={true}>
            <tbody>
              <TableRow class="border-0">
                <TableCell
                  colspan={columns().length}
                  class="h-24 text-center text-muted-foreground"
                >
                  <EmptyMessage {...props} />
                </TableCell>
              </TableRow>
            </tbody>
          </Match>
        </Switch>
      </Table>
    </div>
  );
}

interface DataTableGridRowProps<TData extends RowData> {
  measure: (element: HTMLElement) => void;
  index: number;
  cells: DataTableCell<TData>[];
}

function DataTableGridRow<TData extends RowData>(props: DataTableGridRowProps<TData>) {
  return (
    <tbody
      ref={(element) => props.measure(element)}
      data-index={props.index}
      class="last:[&>tr:last-child]:border-0"
    >
      <TableRow>
        <For each={props.cells}>
          {(cell) => (
            <TableCell
              class={cn(
                "h-12",
                !cell.column.columnDef.meta?.actions && "truncate",
                cell.column.columnDef.meta?.primary && "font-medium",
                cell.column.columnDef.meta?.align === "center" && "text-center"
              )}
            >
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </TableCell>
          )}
        </For>
      </TableRow>
    </tbody>
  );
}
