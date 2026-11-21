import { Show } from "solid-js";
import type { RowData } from "@tanstack/table-core";

import { Select, type SelectOption } from "@/shared/ui/shadcn/select.tsx";
import { Badge } from "@/shared/ui/shadcn/badge.tsx";
import type { DataTableColumn } from "@/shared/lib/table.ts";

type FilterableColumn = Pick<DataTableColumn<RowData>, "getFilterValue" | "setFilterValue">;

export interface DataTableFacetedFilterProps {
  column?: FilterableColumn;
  title?: string;
  multiple?: boolean;
  options: SelectOption[];
}

const TRIGGER_CLASS = "w-full max-w-full border-dashed md:w-max";

export function DataTableFacetedFilter(props: DataTableFacetedFilterProps) {
  return (
    <Show when={props.column}>
      {(column) => {
        const selected = () => toSelectedValues(column().getFilterValue());
        return (
          <div class="flex w-full items-center md:w-auto">
            <Show
              when={props.multiple ?? true}
              fallback={
                <Select
                  aria-label={props.title}
                  placeholder={props.title}
                  placement="bottom-start"
                  class={TRIGGER_CLASS}
                  options={props.options}
                  value={selected()[0] ?? null}
                  onChange={(value) => column().setFilterValue(value || undefined)}
                />
              }
            >
              {/* The trigger is named by what it shows, which always holds the title. */}
              <Select
                multiple
                placeholder={props.title}
                placement="bottom-start"
                class={TRIGGER_CLASS}
                options={props.options}
                value={selected()}
                onChange={(values) =>
                  column().setFilterValue(values.length > 0 ? values : undefined)
                }
                renderSelected={(chosen) => (
                  <span class="flex items-center gap-1.5">
                    <Badge variant="secondary">{chosen.length}</Badge>
                    {props.title}
                  </span>
                )}
              />
            </Show>
          </div>
        );
      }}
    </Show>
  );
}

function toSelectedValues(filterValue: unknown): string[] {
  if (Array.isArray(filterValue)) {
    return filterValue.filter((value): value is string => typeof value === "string");
  }
  return typeof filterValue === "string" ? [filterValue] : [];
}
