import * as React from "react";
import { useDebouncer } from "@tanstack/react-pacer";
import { Input } from "@/shared/ui/shadcn/input.tsx";
import { SEARCH_DEBOUNCE_MS } from "@/shared/config/search.ts";

interface DebouncedSearchInputProps extends Omit<
  React.ComponentProps<typeof Input>,
  "onChange" | "type" | "value"
> {
  value: string;
  onValueChange: (value: string) => void;
}

export function DebouncedSearchInput({
  value,
  onValueChange,
  ...props
}: DebouncedSearchInputProps) {
  const [localValue, setLocalValue] = React.useState(value);
  const [committedValue, setCommittedValue] = React.useState(value);
  const debouncer = useDebouncer(
    (next: string) => {
      setCommittedValue(next);
      onValueChange(next);
    },
    { wait: SEARCH_DEBOUNCE_MS }
  );

  // An outside change (e.g. a filter reset) replaces the draft and drops its pending commit.
  if (value !== committedValue) {
    setCommittedValue(value);
    setLocalValue(value);
    debouncer.cancel();
  }

  return (
    <Input
      type="search"
      value={localValue}
      onChange={(event) => {
        setLocalValue(event.target.value);
        debouncer.maybeExecute(event.target.value);
      }}
      {...props}
    />
  );
}
