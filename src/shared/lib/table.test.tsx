import { page as screen } from "vitest/browser";
import { render } from "vitest-browser-react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SEARCH_DEBOUNCE_MS } from "@/shared/config/search.ts";
import type { SortingState } from "@tanstack/react-table";
import { DataTable } from "@/shared/ui/data-table/DataTable.tsx";
import { DataTablePagination } from "@/shared/ui/data-table/DataTablePagination.tsx";
import { DataTableToolbar } from "@/shared/ui/data-table/DataTableToolbar.tsx";
import { useDataTable, type DataTableColumnDef } from "@/shared/lib/table.ts";
interface Widget {
  id: string;
  name: string;
  kind: string;
}
const widgets: Widget[] = [
  { id: "1", name: "Charlie", kind: "beta" },
  { id: "2", name: "alpha", kind: "beta" },
  { id: "3", name: "Bravo", kind: "gamma" },
];
const columns: DataTableColumnDef<Widget>[] = [
  { accessorKey: "name", header: "Name", cell: ({ row }) => <span>{row.original.name}</span> },
  { accessorKey: "kind", header: "Kind", meta: { align: "center", tooltip: "Widget kind" } },
];
function Harness() {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const table = useDataTable({
    data: widgets,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    initialState: { pagination: { pageIndex: 0, pageSize: 2 } },
    globalFilterFn: "auto",
  });

  return (
    <div>
      <DataTableToolbar table={table} searchPlaceholder="Search" />
      <button type="button" onClick={() => setGlobalFilter("bravo")}>
        Filter to bravo
      </button>
      <DataTable table={table} />
      <DataTablePagination table={table} />
      <output data-testid="facets">
        {[...table.getColumn("kind")!.getFacetedUniqueValues().keys()]
          .map(String)
          .sort((a, b) => a.localeCompare(b))
          .join(",")}
      </output>
    </div>
  );
}
function UncontrolledHarness() {
  const table = useDataTable({
    data: widgets,
    columns,
    initialState: { sorting: [{ id: "name", desc: false }] },
  });

  return <DataTable table={table} />;
}
function bodyRowNames() {
  const rows = screen.getByRole("table").first().getByRole("row").all().slice(1);
  return rows.map((row) => row.getByRole("cell").first().element().textContent);
}
describe("shared data table features", () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());
  it("paginates, sorts, filters and facets through the registered features", async () => {
    await render(<Harness />);

    // paginatedRowModel: pageSize 2 of 3 rows
    expect(bodyRowNames()).toEqual(["Charlie", "alpha"]);

    // facetedUniqueValues via columnFacetingFeature
    expect(screen.getByTestId("facets").element().textContent).toBe("beta,gamma");

    // sortedRowModel + registered sortFns (text/alphanumeric auto resolution)
    await screen.getByRole("button", { name: /Name/ }).click();
    expect(bodyRowNames()).toEqual(["alpha", "Bravo"]);

    // filteredRowModel + globalFilterFn: "auto" (includesString)
    await screen.getByRole("button", { name: "Filter to bravo" }).click();
    expect(bodyRowNames()).toEqual(["Bravo"]);
  });
  it("renders string header titles as sortable column headers", async () => {
    await render(<Harness />);
    await screen.getByRole("button", { name: /Sort ascending by Kind/ }).click();
    expect(bodyRowNames()).toEqual(["Charlie", "alpha"]);
    await screen.getByRole("button", { name: /Sort descending by Kind/ }).click();
    expect(bodyRowNames()).toEqual(["Bravo", "Charlie"]);
  });
  it("manages sorting internally when only initialState.sorting is given", async () => {
    await render(<UncontrolledHarness />);

    // initialState.sorting is applied without any controlled sorting state.
    expect(bodyRowNames()).toEqual(["alpha", "Bravo", "Charlie"]);

    // Toggling a header still updates sorting through the feature default updater.
    await screen.getByRole("button", { name: /Sort descending by Name/ }).click();
    expect(bodyRowNames()).toEqual(["Charlie", "Bravo", "alpha"]);
  });
  it("drives the toolbar search box through the table global filter", async () => {
    await render(<Harness />);
    await screen.getByPlaceholder("Search").fill("bravo");
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    await expect.poll(bodyRowNames).toEqual(["Bravo"]);
  });
});
