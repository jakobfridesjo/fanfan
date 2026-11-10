import {
  type Cell,
  type CellData,
  type Column,
  type ColumnDef,
  columnFacetingFeature,
  columnFilteringFeature,
  columnVisibilityFeature,
  createFacetedRowModel,
  createFacetedUniqueValues,
  createFilteredRowModel,
  createSortedRowModel,
  filterFn_arrIncludes,
  filterFn_equals,
  filterFn_includesString,
  filterFn_inDateRange,
  filterFn_inNumberRange,
  filterFn_weakEquals,
  globalFilteringFeature,
  metaHelper,
  type ReactTable,
  type Row,
  type RowData,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_datetime,
  sortFn_text,
  type TableOptions,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";

interface DataTableColumnMeta {
  align?: "center";
  tooltip?: string;
  mobileLabel?: string;
  primary?: boolean;
  mobileHidden?: boolean;
  actions?: boolean;
  mobileFullWidth?: boolean;
  /** A CSS width; columns without one share the rest of the table. */
  width?: string;
}

const dataTableFeatures = tableFeatures({
  columnFacetingFeature,
  columnFilteringFeature,
  columnVisibilityFeature,
  globalFilteringFeature,
  rowSortingFeature,
  facetedRowModel: createFacetedRowModel(),
  facetedUniqueValues: createFacetedUniqueValues(),
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  filterFns: {
    arrIncludes: filterFn_arrIncludes,
    equals: filterFn_equals,
    includesString: filterFn_includesString,
    inDateRange: filterFn_inDateRange,
    inNumberRange: filterFn_inNumberRange,
    weakEquals: filterFn_weakEquals,
  },
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    datetime: sortFn_datetime,
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
