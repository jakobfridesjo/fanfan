import { page as screen } from "vitest/browser";
import { createSignal } from "solid-js";
import { describe, expect, it } from "vitest";
import type { SortingState } from "@tanstack/table-core";
import { render } from "@/shared/test/solid.ts";
import { DataTable } from "@/shared/ui/data-table/DataTable.tsx";
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
  const [sorting, setSorting] = createSignal<SortingState>([]);
  const [globalFilter, setGlobalFilter] = createSignal("");

  const table = useDataTable({
    data: widgets,
    columns,
    state: {
      get sorting() {
        return sorting();
      },
      get globalFilter() {
        return globalFilter();
      },
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: "auto",
  });

  return (
    <div>
      <button type="button" onClick={() => setGlobalFilter("bravo")}>
        Filter to bravo
      </button>
      <DataTable table={table} />
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
const manyWidgets: Widget[] = Array.from({ length: 1000 }, (_, index) => ({
  id: `${index}`,
  name: `Widget ${index}`,
  kind: "beta",
}));
function ScrollingHarness() {
  const table = useDataTable({ data: manyWidgets, columns });

  return (
    <div style={{ height: "300px", display: "flex", "flex-direction": "column" }}>
      <DataTable table={table} class="min-h-0 grow" />
    </div>
  );
}
function bodyRowNames() {
  const rows = screen.getByRole("table").first().getByRole("row").all().slice(1);
  return rows.map((row) => row.getByRole("cell").first().element().textContent);
}
describe("shared data table features", () => {
  it("sorts and filters through the registered features", async () => {
    render(() => <Harness />);

    await expect.poll(bodyRowNames).toEqual(["Charlie", "alpha", "Bravo"]);

    // sortedRowModel + registered sortFns (text/alphanumeric auto resolution)
    await screen.getByRole("button", { name: /Name/ }).click();
    await expect.poll(bodyRowNames).toEqual(["alpha", "Bravo", "Charlie"]);

    // filteredRowModel + globalFilterFn: "auto" (includesString)
    await screen.getByRole("button", { name: "Filter to bravo" }).click();
    await expect.poll(bodyRowNames).toEqual(["Bravo"]);
  });
  it("renders string header titles as sortable column headers", async () => {
    render(() => <Harness />);
    await screen.getByRole("button", { name: /Sort ascending by Kind/ }).click();
    await expect.poll(bodyRowNames).toEqual(["Charlie", "alpha", "Bravo"]);
    await screen.getByRole("button", { name: /Sort descending by Kind/ }).click();
    await expect.poll(bodyRowNames).toEqual(["Bravo", "Charlie", "alpha"]);
  });
  it("manages sorting internally when only initialState.sorting is given", async () => {
    render(() => <UncontrolledHarness />);

    // initialState.sorting is applied without any controlled sorting state.
    await expect.poll(bodyRowNames).toEqual(["alpha", "Bravo", "Charlie"]);

    // Toggling a header still updates sorting through the feature default updater.
    await screen.getByRole("button", { name: /Sort descending by Name/ }).click();
    await expect.poll(bodyRowNames).toEqual(["Charlie", "Bravo", "alpha"]);
  });
  it("renders only the rows near view and more as it scrolls", async () => {
    render(() => <ScrollingHarness />);
    await expect.poll(() => bodyRowNames()[0]).toBe("Widget 0");
    expect(bodyRowNames().length).toBeLessThan(50);

    const scroller = screen.getByRole("table").element().closest(".overflow-auto")!;
    scroller.scrollTop = scroller.scrollHeight;
    await expect.poll(() => bodyRowNames().at(-1)).toBe("Widget 999");
    expect(bodyRowNames().length).toBeLessThan(50);
  });
});
