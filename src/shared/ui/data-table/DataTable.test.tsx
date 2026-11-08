import { page as screen, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { expect, it, vi } from "vitest";
import { DataTable } from "@/shared/ui/data-table/DataTable.tsx";
import { type DataTableColumnDef, useDataTable } from "@/shared/lib/table.ts";

interface Row {
  name: string;
}

const COLUMNS: DataTableColumnDef<Row>[] = [
  { accessorKey: "name", header: "Name" },
  {
    id: "actions",
    header: "",
    cell: () => <button type="button">Edit</button>,
  },
];

const ROWS: Row[] = [{ name: "Alice" }, { name: "Bob" }];

function Harness({ onRowClick }: { onRowClick: (row: Row) => void }) {
  const table = useDataTable({ data: ROWS, columns: COLUMNS });
  return <DataTable table={table} onRowClick={onRowClick} />;
}

it("activates a clickable row from the keyboard without double-firing from inner controls", async () => {
  const onRowClick = vi.fn();
  await render(<Harness onRowClick={onRowClick} />);

  const alice = screen.getByRole("row", { name: /Alice/ });
  await expect.element(alice).toHaveAttribute("tabindex", "0");
  alice.element().focus();
  await userEvent.keyboard("{Enter}");
  expect(onRowClick).toHaveBeenLastCalledWith({ name: "Alice" });

  screen.getByRole("row", { name: /Bob/ }).element().focus();
  await userEvent.keyboard(" ");
  expect(onRowClick).toHaveBeenLastCalledWith({ name: "Bob" });

  screen.getByRole("button", { name: "Edit" }).nth(1).element().focus();
  await userEvent.keyboard("{Enter}");
  expect(onRowClick).toHaveBeenCalledTimes(3);
});

it("ignores row clicks that end a text selection", async () => {
  const onRowClick = vi.fn();
  await render(<Harness onRowClick={onRowClick} />);

  const cell = screen.getByRole("cell", { name: "Alice" }).element();
  await screen.getByRole("cell", { name: "Alice" }).click();
  expect(onRowClick).toHaveBeenCalledTimes(1);

  window.getSelection()?.selectAllChildren(cell);
  await screen.getByRole("cell", { name: "Alice" }).click();
  expect(onRowClick).toHaveBeenCalledTimes(1);
});
