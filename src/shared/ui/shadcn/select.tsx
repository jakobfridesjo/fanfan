import type { JSX } from "@solidjs/web";
import { Show } from "solid-js";
import { Select as SelectPrimitive } from "@kobalte/core/select";
import { Check, ChevronDown, type IconNode } from "lucide";
import { cn } from "@/shared/lib/class-names.ts";
import { Icon } from "@/shared/ui/Icon.tsx";

export interface SelectOption {
  value: string;
  /** What screen readers and type-ahead go by. */
  label: string;
  /** Shown in place of `label`, say to mark its language. */
  content?: () => JSX.Element;
  icon?: IconNode;
  indentLevel?: number;
}

interface SelectBaseProps {
  options: SelectOption[];
  "aria-label"?: string;
  placeholder?: string;
  /** Classes for the trigger. */
  class?: string;
  placement?: "bottom" | "bottom-start";
}

interface SingleSelectProps extends SelectBaseProps {
  multiple?: false;
  value: string | null;
  onChange: (value: string | null) => void;
}

interface MultipleSelectProps extends SelectBaseProps {
  multiple: true;
  value: string[];
  onChange: (values: string[]) => void;
  /** What the trigger shows for the options chosen. */
  renderSelected: (selected: SelectOption[]) => JSX.Element;
}

const TRIGGER_CLASS =
  "flex h-8 w-fit max-w-full items-center justify-between gap-1.5 rounded-2xl border border-input bg-transparent px-3 py-2 text-sm whitespace-nowrap transition-[color,box-shadow] duration-200 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";

// As wide as its longest option, capped to the viewport.
const CONTENT_CLASS =
  "relative isolate z-50 max-h-(--kb-popper-content-available-height) w-max max-w-[calc(100vw-2rem)] min-w-(--kb-popper-anchor-width) origin-(--kb-select-content-transform-origin) overflow-x-auto overflow-y-auto rounded-2xl bg-popover text-popover-foreground shadow-lg ring-1 ring-foreground/5 duration-100 dark:ring-foreground/10 data-expanded:animate-in data-expanded:fade-in-0 data-expanded:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95";

const ITEM_CLASS =
  "relative flex min-h-7 w-full cursor-default items-center gap-2 rounded-xl py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 data-highlighted:bg-accent data-highlighted:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";

function OptionContent(props: { option: SelectOption }) {
  return <>{props.option.content ? props.option.content() : props.option.label}</>;
}

function SelectItem(props: { item: Parameters<typeof SelectPrimitive.Item>[0]["item"] }) {
  const option = () => props.item.rawValue as SelectOption;
  return (
    <SelectPrimitive.Item data-slot="select-item" item={props.item} class={ITEM_CLASS}>
      <SelectPrimitive.ItemLabel class="flex flex-1 shrink-0 items-center gap-2 whitespace-nowrap">
        <Show when={option().icon}>
          {(icon) => <Icon icon={icon()} class="text-muted-foreground" />}
        </Show>
        <span
          style={
            option().indentLevel
              ? { "padding-inline-start": `${(option().indentLevel ?? 0) * 0.75}rem` }
              : undefined
          }
        >
          <OptionContent option={option()} />
        </span>
      </SelectPrimitive.ItemLabel>
      <SelectPrimitive.ItemIndicator class="pointer-events-none absolute right-2 flex size-4 items-center justify-center">
        <Icon icon={Check} />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}

function SelectTrigger(props: { "aria-label"?: string; class?: string; children: JSX.Element }) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      role="combobox"
      aria-label={props["aria-label"]}
      class={cn(TRIGGER_CLASS, props.class)}
    >
      {props.children}
      <SelectPrimitive.Icon>
        <Icon icon={ChevronDown} class="size-4 text-muted-foreground" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

function SelectContent() {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content data-slot="select-content" class={CONTENT_CLASS}>
        <SelectPrimitive.Listbox class="p-1 outline-none" />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

const VALUE_CLASS = "flex min-w-0 flex-1 text-left data-placeholder-shown:text-muted-foreground";

/** A dropdown of `options`, of which one is chosen, or any number with `multiple`. */
function Select(props: SingleSelectProps | MultipleSelectProps) {
  const chosen = (value: string) => props.options.find((option) => option.value === value);
  const shared = {
    optionValue: "value",
    optionTextValue: "label",
    gutter: 4,
    itemComponent: SelectItem,
  } as const;

  return (
    <Show
      when={props.multiple === true && props}
      fallback={
        <SelectPrimitive<SelectOption>
          {...shared}
          options={props.options}
          placement={props.placement ?? "bottom"}
          placeholder={props.placeholder}
          value={chosen((props as SingleSelectProps).value ?? "") ?? null}
          onChange={(option) => (props as SingleSelectProps).onChange(option?.value ?? null)}
        >
          <SelectTrigger aria-label={props["aria-label"]} class={props.class}>
            <SelectPrimitive.Value<SelectOption> data-slot="select-value" class={VALUE_CLASS}>
              {(state) => (
                <span class="truncate">
                  <OptionContent option={state.selectedOption()} />
                </span>
              )}
            </SelectPrimitive.Value>
          </SelectTrigger>
          <SelectContent />
        </SelectPrimitive>
      }
    >
      {(many) => (
        <SelectPrimitive<SelectOption>
          {...shared}
          multiple
          options={many().options}
          placement={many().placement ?? "bottom"}
          placeholder={many().placeholder}
          value={many().value.flatMap((value) => chosen(value) ?? [])}
          onChange={(options) => many().onChange(options.map((option) => option.value))}
        >
          <SelectTrigger aria-label={many()["aria-label"]} class={many().class}>
            <SelectPrimitive.Value<SelectOption> data-slot="select-value" class={VALUE_CLASS}>
              {(state) => (
                <span class="truncate">{many().renderSelected(state.selectedOptions())}</span>
              )}
            </SelectPrimitive.Value>
          </SelectTrigger>
          <SelectContent />
        </SelectPrimitive>
      )}
    </Show>
  );
}

export { Select };
