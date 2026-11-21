import { createEffect, createSignal, onSettled, untrack } from "solid-js";
import {
  elementScroll,
  observeElementOffset,
  observeElementRect,
  Virtualizer,
} from "@tanstack/virtual-core";

/**
 * The rows in and near view of the scroll element given to `scrollRef`, with the space taken by
 * those above and below. Each rendered row passes its element to `measure`.
 */
export function useVirtualRows<Row extends { id: string }>(
  rows: () => Row[],
  estimatedHeight: number
) {
  let scrollElement: HTMLDivElement | null = null;
  const [version, setVersion] = createSignal(0, { ownedWrite: true });
  const optionsFor = (current: Row[]) => {
    return {
      count: current.length,
      getScrollElement: () => scrollElement,
      estimateSize: () => estimatedHeight,
      getItemKey: (index: number) => current[index]?.id ?? index,
      overscan: 10,
      observeElementRect,
      observeElementOffset,
      scrollToFn: elementScroll,
      onChange: () => setVersion((count) => count + 1),
    };
  };
  const virtualizer = new Virtualizer<HTMLDivElement, HTMLElement>(optionsFor(untrack(rows)));

  onSettled(() => {
    const unmount = virtualizer._didMount();
    virtualizer._willUpdate();
    return unmount;
  });
  createEffect(rows, (current) => {
    virtualizer.setOptions(optionsFor(current));
    virtualizer._willUpdate();
    setVersion((count) => count + 1);
  });

  const items = () => {
    version();
    rows();
    return virtualizer.getVirtualItems();
  };

  return {
    scrollRef: (element: HTMLDivElement) => {
      scrollElement = element;
    },
    measure: (element: HTMLElement) => {
      queueMicrotask(() => virtualizer.measureElement(element));
    },
    get visible() {
      const current = rows();
      return items().flatMap((item) => {
        const row = current[item.index];
        return row ? [{ index: item.index, row }] : [];
      });
    },
    get spaceBefore() {
      return items()[0]?.start ?? 0;
    },
    get spaceAfter() {
      const last = items().at(-1);
      return last ? virtualizer.getTotalSize() - last.end : 0;
    },
  };
}
