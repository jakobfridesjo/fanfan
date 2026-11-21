import type { JSX } from "@solidjs/web";
import {
  createEffect,
  createMemo,
  createRoot,
  createSignal,
  getOwner,
  merge,
  runWithOwner,
  untrack,
  type Accessor,
  type Owner,
} from "solid-js";
import {
  type Cell,
  type CellData,
  type Column,
  type ColumnDef,
  columnFilteringFeature,
  constructTable,
  createFilteredRowModel,
  createSortedRowModel,
  filterFn_arrIncludes,
  filterFn_includesString,
  globalFilteringFeature,
  metaHelper,
  type Row,
  type RowData,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_text,
  type Table,
  type TableOptions,
  tableFeatures,
} from "@tanstack/table-core";

interface DataTableColumnMeta {
  align?: "center";
  tooltip?: string;
  primary?: boolean;
  actions?: boolean;
  mobileFullWidth?: boolean;
  /** A CSS width; columns without one share the rest of the table. */
  width?: string;
}

type Observer<T> = ((value: T) => void) | { next?: (value: T) => void };

/** What table-core asks of an atom, on a Solid signal: reading it in JSX or a memo follows it. */
function atomOf<T>(read: Accessor<T>, owner: Owner | null) {
  return {
    get: read,
    subscribe: (observer: Observer<T>) => {
      const notify =
        typeof observer === "function" ? observer : (value: T) => observer.next?.(value);
      const dispose = runWithOwner(owner, () =>
        createRoot((disposeRoot) => {
          createEffect(read, (value) => notify(value), { defer: true });
          return disposeRoot;
        })
      );
      return { unsubscribe: () => dispose?.() };
    },
  };
}

/** Table-core's state on Solid signals, so table APIs read in JSX, a memo or an effect follow it. */
function solidReactivity(owner: Owner | null) {
  const subscriptions = new Set<{ unsubscribe: () => void }>();
  return {
    createOptionsStore: true,
    wrapExternalAtoms: true,
    addSubscription: (subscription: { unsubscribe: () => void }) => {
      subscriptions.add(subscription);
    },
    unmount: () => {
      for (const subscription of subscriptions) subscription.unsubscribe();
      subscriptions.clear();
    },
    schedule: (run: () => void) => queueMicrotask(run),
    createReadonlyAtom: <T>(compute: () => T, options?: { compare?: (a: T, b: T) => boolean }) =>
      atomOf(
        runWithOwner(owner, () => createMemo(compute, { equals: options?.compare })) as Accessor<T>,
        owner
      ),
    createWritableAtom: <T>(initial: T, options?: { compare?: (a: T, b: T) => boolean }) => {
      // A signal shows a write only after the next flush; the table reads back what it just wrote.
      let current = initial;
      const [tracked, setTracked] = createSignal<unknown>(initial, { ownedWrite: true });
      const read = () => {
        tracked();
        return current;
      };
      return Object.assign(atomOf(read, owner), {
        set: (next: T | ((previous: T) => T)) => {
          const value = typeof next === "function" ? (next as (previous: T) => T)(current) : next;
          if (options?.compare ? options.compare(current, value) : Object.is(current, value))
            return;
          current = value;
          setTracked(() => value);
        },
      });
    },
    untrack,
    batch: (run: () => void) => run(),
  };
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

export type DataTableInstance<TData extends RowData> = Table<DataTableFeatures, TData>;

export type DataTableOptions<TData extends RowData> = Omit<
  TableOptions<DataTableFeatures, TData>,
  "features"
>;

/**
 * A table over `options`, whose `data` and `state` may be getters over signals. Its APIs
 * (`getRowModel()`, `column.getIsSorted()`) follow the table's state where they are read.
 */
export function useDataTable<TData extends RowData>(
  options: DataTableOptions<TData>
): DataTableInstance<TData> {
  const owner = getOwner();
  const reactivity = solidReactivity(owner);
  const withFeatures = merge(options, {
    features: { coreReactivityFeature: reactivity, ...dataTableFeatures },
  }) as unknown as TableOptions<DataTableFeatures, TData>;
  // Built once, from the options as they are now; the table's atoms follow them from here on.
  const table = untrack(() =>
    constructTable(
      merge(
        {
          mergeOptions: (defaults: object, given: object) => merge(defaults, given),
        },
        withFeatures
      ) as TableOptions<DataTableFeatures, TData>
    )
  );

  createEffect(
    () => {
      const state = options.state as Record<string, unknown> | undefined;
      return state ? Object.keys(state).map((key) => state[key]) : [];
    },
    () => {
      // The table reads its own state as it takes the options in; nothing here follows those reads.
      untrack(() => table.setOptions((previous) => merge(previous, withFeatures)));
    }
  );
  createEffect(
    () => undefined,
    () => () => reactivity.unmount()
  );

  return table;
}

/** A column's header or cell template, with its context: a string as it is, a function as a component. */
export function flexRender<TProps extends object>(
  template: string | ((props: TProps) => JSX.Element) | undefined,
  props: TProps
): JSX.Element {
  if (typeof template === "function") return untrack(() => template(props));
  return template ?? null;
}
