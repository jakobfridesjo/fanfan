import { page as screen, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { expect, it } from "vitest";
import { Fragment, useState } from "react";
import { type ColumnFiltersState, flexRender, type SortingState } from "@tanstack/react-table";
import { DataTableFacetedFilter } from "@/shared/ui/data-table/DataTableFacetedFilter.tsx";
import { DataTableColumnHeader } from "@/shared/ui/data-table/DataTableColumnHeader.tsx";
import { type DataTableColumnDef, useDataTable } from "@/shared/lib/table.ts";

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
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const table = useDataTable({
    data: [{ role: "admin" }, { role: "editor" }],
    columns: COLUMNS,
    state: { columnFilters, sorting },
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
      {table.getFlatHeaders().map((header) => (
        <Fragment key={header.id}>
          {flexRender(header.column.columnDef.header, header.getContext())}
        </Fragment>
      ))}
    </>
  );
}

it("marks the selected options and counts them on the trigger", async () => {
  await render(<Harness />);
  const trigger = screen.getByRole("combobox", { name: "Roles" });

  await userEvent.click(trigger);
  await screen.getByRole("option", { name: "Admin" }).click();

  await expect
    .element(screen.getByRole("option", { name: "Admin" }))
    .toHaveAttribute("aria-selected", "true");
  expect(trigger.element().textContent).toContain("1Roles");
});

it("shows the active sort direction on the column header", async () => {
  await render(<Harness />);

  await screen.getByRole("button", { name: "Sort ascending by Role" }).click();

  await expect
    .element(screen.getByRole("button", { name: "Sort descending by Role" }))
    .toContainHTML("lucide-arrow-up");
});
