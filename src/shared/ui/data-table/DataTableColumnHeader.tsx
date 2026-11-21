import { Show } from "solid-js";
import type { RowData } from "@tanstack/table-core";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide";

import { cn } from "@/shared/lib/class-names.ts";
import { useMessages } from "@/shared/i18n/messages.ts";
import { Icon } from "@/shared/ui/Icon.tsx";
import { Button } from "@/shared/ui/shadcn/button.tsx";
import type { DataTableColumn } from "@/shared/lib/table.ts";

type SortableColumn = Pick<
  DataTableColumn<RowData>,
  "getCanSort" | "getIsSorted" | "getNextSortingOrder" | "toggleSorting"
>;

interface DataTableColumnHeaderProps {
  column: SortableColumn;
  title: string;
  class?: string;
}

export function DataTableColumnHeader(props: DataTableColumnHeaderProps) {
  const m = useMessages();
  const sortAction = () => {
    const next = props.column.getNextSortingOrder();
    const action =
      next === "asc"
        ? m.table.sortAscending
        : next === "desc"
          ? m.table.sortDescending
          : m.table.clearSorting;
    return action(props.title);
  };
  const sortIcon = () => {
    const sorted = props.column.getIsSorted();
    return sorted === "desc" ? ArrowDown : sorted === "asc" ? ArrowUp : ChevronsUpDown;
  };

  return (
    <Show when={props.column.getCanSort()} fallback={<div class={props.class}>{props.title}</div>}>
      <div class={cn("flex items-center gap-2", props.class)}>
        <Button
          variant="ghost"
          class="-ml-3"
          onClick={() => props.column.toggleSorting()}
          aria-label={sortAction()}
          title={sortAction()}
        >
          <span>{props.title}</span>
          <Show when={sortIcon()} keyed>
            {(icon) => <Icon icon={icon} data-slot="sort-icon" />}
          </Show>
        </Button>
      </div>
    </Show>
  );
}
