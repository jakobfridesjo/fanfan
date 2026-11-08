import * as React from "react";
import { type RowData, Subscribe } from "@tanstack/react-table";

import { Select, SelectGroup, SelectItem, SelectTrigger } from "@/shared/ui/shadcn/select.tsx";
import { FitSelectContent } from "@/shared/ui/FitSelectContent.tsx";
import { Badge } from "@/shared/ui/shadcn/badge.tsx";
import { SelectDisplayValue } from "@/shared/ui/SelectDisplayValue.tsx";
import type { DataTableColumn, DataTableInstance } from "@/shared/lib/table.ts";

type FilterableColumn = Pick<DataTableColumn<RowData>, "getFilterValue" | "setFilterValue"> & {
  table: { atoms: Pick<DataTableInstance<RowData>["atoms"], "columnFilters"> };
};

export interface DataTableFacetedFilterProps {
  column?: FilterableColumn;
  title?: string;
  multiple?: boolean;
  options: {
    label: string;
    value: string;
    icon?: React.ComponentType<{ className?: string }>;
    indentLevel?: number;
  }[];
}

export function DataTableFacetedFilter({
  column,
  title,
  multiple = true,
  options,
}: DataTableFacetedFilterProps) {
  if (!column) return null;

  const items = options.map((option) => (
    <SelectItem key={option.value} value={option.value}>
      {option.icon && <option.icon className="text-muted-foreground" />}
      <span
        style={
          option.indentLevel ? { paddingInlineStart: `${option.indentLevel * 0.75}rem` } : undefined
        }
      >
        {option.label}
      </span>
    </SelectItem>
  ));

  const trigger = (children: React.ReactNode) => (
    <SelectTrigger className="w-full max-w-full border-dashed md:w-max" aria-label={title}>
      {children}
    </SelectTrigger>
  );

  const content = (
    <FitSelectContent align="start">
      <SelectGroup>{items}</SelectGroup>
    </FitSelectContent>
  );

  return (
    <Subscribe source={column.table.atoms.columnFilters}>
      {() => {
        const selectedValues = toSelectedValues(column.getFilterValue());

        if (!multiple) {
          return (
            <div className="flex w-full items-center md:w-auto">
              <Select
                value={selectedValues[0] ?? null}
                onValueChange={(value: string | null) => column.setFilterValue(value || undefined)}
              >
                {trigger(<SelectDisplayValue placeholder={title} options={options} />)}
                {content}
              </Select>
            </div>
          );
        }

        return (
          <div className="flex w-full items-center md:w-auto">
            <Select
              multiple
              value={selectedValues}
              onValueChange={(values: string[]) =>
                column.setFilterValue(values.length > 0 ? values : undefined)
              }
            >
              {trigger(
                <SelectDisplayValue
                  placeholder={title}
                  options={options}
                  renderSelected={({ selectedValues: values }) => (
                    <span className="flex items-center gap-1.5">
                      <Badge variant="secondary">{values.length}</Badge>
                      {title}
                    </span>
                  )}
                />
              )}
              {content}
            </Select>
          </div>
        );
      }}
    </Subscribe>
  );
}

function toSelectedValues(filterValue: unknown): string[] {
  if (Array.isArray(filterValue)) {
    return filterValue.filter((value): value is string => typeof value === "string");
  }
  return typeof filterValue === "string" ? [filterValue] : [];
}
