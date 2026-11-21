import { For, Show } from "solid-js";
import type { RowData } from "@tanstack/table-core";
import { Skeleton } from "@/shared/ui/shadcn/skeleton.tsx";
import { flexRender, type DataTableCell } from "@/shared/lib/table.ts";
import { cn } from "@/shared/lib/class-names.ts";

function titleCellOf<TData extends RowData>(visibleCells: DataTableCell<TData>[]) {
  return (
    visibleCells.find((cell) => cell.column.columnDef.meta?.primary) ??
    visibleCells.find((cell) => !cell.column.columnDef.meta?.actions) ??
    visibleCells[0]
  );
}

export function DataTableCardSkeletons(props: { rowCount: number }) {
  return (
    <div>
      <For each={Array.from({ length: props.rowCount })}>
        {() => (
          <div class="border-b p-2 last:border-b-0">
            <Skeleton class="mb-3 h-6 w-1/2" />
            <div class="space-y-2">
              <Skeleton class="h-5 w-full" />
              <Skeleton class="h-5 w-5/6" />
              <Skeleton class="h-5 w-2/3" />
            </div>
          </div>
        )}
      </For>
    </div>
  );
}

interface DataTableCardProps<TData extends RowData> {
  /** Given the card's element once it exists, to measure it. */
  measure: (element: HTMLElement) => void;
  /** The row's position in the virtualized list, read when it is measured. */
  index: number;
  cells: DataTableCell<TData>[];
}

export function DataTableCard<TData extends RowData>(props: DataTableCardProps<TData>) {
  const titleCell = () => titleCellOf(props.cells);
  const actionCells = () => props.cells.filter((cell) => cell.column.columnDef.meta?.actions);
  const detailCells = () =>
    props.cells.filter(
      (cell) => cell.id !== titleCell()?.id && !cell.column.columnDef.meta?.actions
    );
  const render = (cell: DataTableCell<TData>) =>
    flexRender(cell.column.columnDef.cell, cell.getContext());

  return (
    <div
      ref={(element) => props.measure(element)}
      data-index={props.index}
      class="border-b p-2 transition-colors last:border-b-0 hover:bg-muted/50"
    >
      <Show when={titleCell() || actionCells().length > 0}>
        <div class="mb-2 flex items-start justify-between gap-3">
          <div class="min-w-0 flex-1">
            <Show when={titleCell()} keyed>
              {(cell) => (
                <div class="min-w-0 text-sm font-semibold text-foreground">{render(cell)}</div>
              )}
            </Show>
          </div>
          <Show when={actionCells().length > 0}>
            <div class="flex shrink-0 items-center gap-1">
              <For each={actionCells()}>{(cell) => <div>{render(cell)}</div>}</For>
            </div>
          </Show>
        </div>
      </Show>

      <Show when={detailCells().length > 0}>
        <div class="space-y-2">
          <For each={detailCells()}>
            {(cell) => {
              const { header, meta } = cell.column.columnDef;
              return (
                <div
                  class={cn(
                    "flex gap-3",
                    meta?.mobileFullWidth ? "flex-col items-start" : "items-start justify-between"
                  )}
                >
                  <div class="shrink-0 text-2xs font-medium tracking-[0.08em] text-muted-foreground uppercase">
                    {typeof header === "string" ? header : cell.column.id}
                  </div>
                  <div
                    class={cn(
                      "min-w-0 text-sm text-foreground",
                      !meta?.mobileFullWidth && "text-right"
                    )}
                  >
                    {render(cell)}
                  </div>
                </div>
              );
            }}
          </For>
        </div>
      </Show>
    </div>
  );
}
