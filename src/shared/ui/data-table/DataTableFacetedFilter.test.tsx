import { page as screen, userEvent } from "vitest/browser";
import { expect, it } from "vitest";
import { createSignal, For } from "solid-js";
import type { ColumnFiltersState, SortingState } from "@tanstack/table-core";
import { render } from "@/shared/test/solid.ts";
import { DataTableFacetedFilter } from "@/shared/ui/data-table/DataTableFacetedFilter.tsx";
import { DataTableColumnHeader } from "@/shared/ui/data-table/DataTableColumnHeader.tsx";
import { type DataTableColumnDef, flexRender, useDataTable } from "@/shared/lib/table.ts";

interface Row {
  role: string;
}

const COLUMNS: DataTableColumnDef<Row>[] = [
  {
    accessorKey: "role",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Role" />,
    filterFn: "arrIncludes",
  },
];

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "editor", label: "Editor" },
];

function Harness() {
  const [columnFilters, setColumnFilters] = createSignal<ColumnFiltersState>([]);
  const [sorting, setSorting] = createSignal<SortingState>([]);
  const table = useDataTable<Row>({
    data: [{ role: "admin" }, { role: "editor" }],
    columns: COLUMNS,
    state: {
      get columnFilters() {
        return columnFilters();
      },
      get sorting() {
        return sorting();
      },
    },
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
  });

  return (
    <>
      <DataTableFacetedFilter
        column={table.getColumn("role")}
        title="Roles"
        options={ROLE_OPTIONS}
      />
      <For each={table.getFlatHeaders()}>
        {(header) => <>{flexRender(header.column.columnDef.header, header.getContext())}</>}
      </For>
    </>
  );
}

it("marks the selected options and counts them on the trigger", async () => {
  render(() => <Harness />);
  const trigger = screen.getByRole("combobox", { name: "Roles" });

  // Its name follows what it shows, so the element is kept from before the choice.
  const triggerElement = trigger.element();
  await userEvent.click(trigger);
  await screen.getByRole("option", { name: "Admin" }).click();

  await expect
    .element(screen.getByRole("option", { name: "Admin" }))
    .toHaveAttribute("aria-selected", "true");
  await expect.poll(() => triggerElement.textContent).toContain("1Roles");
});

it("shows the active sort direction on the column header", async () => {
  render(() => <Harness />);
  const sortIcon = () => document.querySelector("[data-slot=sort-icon]")?.innerHTML;
  const unsorted = sortIcon();

  await screen.getByRole("button", { name: "Sort ascending by Role" }).click();

  await expect
    .element(screen.getByRole("button", { name: "Sort descending by Role" }))
    .toBeVisible();
  const ascending = sortIcon();
  expect(ascending).not.toBe(unsorted);

  await screen.getByRole("button", { name: "Sort descending by Role" }).click();
  await expect.element(screen.getByRole("button", { name: "Clear sorting by Role" })).toBeVisible();
  expect(sortIcon()).not.toBe(ascending);
});
