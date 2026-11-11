import {
  type Cell,
  type CellData,
  type Column,
  type ColumnDef,
  columnFilteringFeature,
  createFilteredRowModel,
  createSortedRowModel,
  filterFn_arrIncludes,
  filterFn_includesString,
  globalFilteringFeature,
  metaHelper,
  type ReactTable,
  type Row,
  type RowData,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_text,
  type TableOptions,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";

interface DataTableColumnMeta {
  align?: "center";
  tooltip?: string;
  primary?: boolean;
  actions?: boolean;
  mobileFullWidth?: boolean;
  /** A CSS width; columns without one share the rest of the table. */
  width?: string;
}

const dataTableFeatures = tableFeatures({
  columnFilteringFeature,
  globalFilteringFeature,
  rowSortingFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  filterFns: {
    arrIncludes: filterFn_arrIncludes,
    includesString: filterFn_includesString,
  },
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    text: sortFn_text,
  },
  columnMeta: metaHelper<DataTableColumnMeta>(),
});

type DataTableFeatures = typeof dataTableFeatures;

export type DataTableColumnDef<
  TData extends RowData,
  TValue extends CellData = CellData,
> = ColumnDef<DataTableFeatures, TData, TValue>;

export type DataTableColumn<TData extends RowData, TValue extends CellData = CellData> = Column<
  DataTableFeatures,
  TData,
  TValue
>;

export type DataTableRow<TData extends RowData> = Row<DataTableFeatures, TData>;

export type DataTableCell<TData extends RowData> = Cell<DataTableFeatures, TData, CellData>;

export type DataTableInstance<TData extends RowData> = ReactTable<DataTableFeatures, TData>;

export type DataTableOptions<TData extends RowData> = Omit<
  TableOptions<DataTableFeatures, TData>,
  "features"
>;

export function useDataTable<TData extends RowData>(
  options: DataTableOptions<TData>
): DataTableInstance<TData> {
  return useTable<DataTableFeatures, TData>({ features: dataTableFeatures, ...options });
}
