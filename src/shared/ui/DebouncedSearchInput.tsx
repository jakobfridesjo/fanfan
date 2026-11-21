import type { ComponentProps } from "@solidjs/web";
import { createEffect, createMemo, omit, onCleanup } from "solid-js";
import { Debouncer } from "@tanstack/pacer";
import { Input } from "@/shared/ui/shadcn/input.tsx";
import { SEARCH_DEBOUNCE_MS } from "@/shared/config/search.ts";

interface DebouncedSearchInputProps extends Omit<
  ComponentProps<typeof Input>,
  "onInput" | "type" | "value"
> {
  value: string;
  onValueChange: (value: string) => void;
}

export function DebouncedSearchInput(props: DebouncedSearchInputProps) {
  const rest = omit(props, "value", "onValueChange");
  let input: HTMLInputElement | undefined;
  let committed: string | undefined;
  const debouncer = new Debouncer(
    (next: string) => {
      committed = next;
      props.onValueChange(next);
    },
    { wait: SEARCH_DEBOUNCE_MS }
  );
  onCleanup(() => debouncer.cancel());

  // An outside change (e.g. a filter reset) replaces the draft and drops its pending commit.
  const value = createMemo(() => props.value);
  createEffect(value, (next) => {
    if (next === committed || !input) return;
    committed = next;
    debouncer.cancel();
    input.value = next;
  });

  return (
    <Input
      type="search"
      {...rest}
      ref={(element) => (input = element)}
      onInput={(event) => debouncer.maybeExecute(event.currentTarget.value)}
    />
  );
}
