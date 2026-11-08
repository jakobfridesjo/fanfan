import * as React from "react";

import { SelectValue } from "@/shared/ui/shadcn/select.tsx";

export interface SelectDisplayOption {
  value: string;
  label: React.ReactNode;
}

interface SelectDisplayValueProps {
  options: readonly SelectDisplayOption[];
  placeholder?: React.ReactNode;
  renderSelected?: (params: {
    selectedValues: string[];
    selectedOptions: SelectDisplayOption[];
  }) => React.ReactNode;
}

function interleaveLabels(options: SelectDisplayOption[]) {
  return options.map((option, index) => (
    <React.Fragment key={option.value}>
      {index > 0 ? ", " : null}
      {option.label}
    </React.Fragment>
  ));
}

function renderSelection(
  value: unknown,
  labelsByValue: Map<string, React.ReactNode>,
  placeholder: React.ReactNode,
  renderSelected: SelectDisplayValueProps["renderSelected"]
) {
  const selectedValues = Array.isArray(value)
    ? value.map((entry) => String(entry))
    : typeof value === "string" && value !== ""
      ? [value]
      : [];

  if (selectedValues.length === 0) {
    return placeholder;
  }

  const selectedOptions = selectedValues.flatMap((selectedValue) => {
    const label = labelsByValue.get(selectedValue);
    return label === undefined ? [] : [{ value: selectedValue, label }];
  });

  if (renderSelected) {
    return renderSelected({ selectedValues, selectedOptions });
  }

  if (selectedOptions.length === 0) {
    return placeholder;
  }

  return interleaveLabels(selectedOptions);
}

export function SelectDisplayValue({
  options,
  placeholder,
  renderSelected,
}: SelectDisplayValueProps) {
  const labelsByValue = new Map(options.map((option) => [option.value, option.label]));

  return (
    <SelectValue placeholder={placeholder}>
      {(value) => (
        <span className="truncate">
          {renderSelection(value, labelsByValue, placeholder, renderSelected)}
        </span>
      )}
    </SelectValue>
  );
}
