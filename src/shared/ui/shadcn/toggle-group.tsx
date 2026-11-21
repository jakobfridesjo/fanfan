import type { JSX } from "@solidjs/web";
import { createContext, useContext } from "solid-js";
import { ToggleGroup as ToggleGroupPrimitive } from "@kobalte/core/toggle-group";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/shared/lib/class-names.ts";

const toggleVariants = cva(
  "group/toggle inline-flex items-center justify-center gap-1 rounded-2xl text-sm font-medium whitespace-nowrap transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50 aria-pressed:bg-muted [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline: "border border-input bg-transparent hover:bg-muted",
      },
      size: {
        default: "h-8 min-w-8 px-2.5",
        sm: "h-7 min-w-7 px-2.5",
        lg: "h-9 min-w-9 px-2.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

type ToggleVariants = VariantProps<typeof toggleVariants>;

const ToggleGroupContext = createContext<ToggleVariants>({});

interface ToggleGroupBaseProps extends ToggleVariants {
  "aria-label": string;
  disabled?: boolean;
  class?: string;
  children: JSX.Element;
}

interface SingleToggleGroupProps extends ToggleGroupBaseProps {
  multiple?: false;
  /** The one option chosen. */
  value: string;
  /** Called with null when the chosen option is pressed again. */
  onChange: (value: string | null) => void;
}

interface MultipleToggleGroupProps extends ToggleGroupBaseProps {
  multiple: true;
  /** The options turned on. */
  value: string[];
  onChange: (value: string[]) => void;
}

/** A row of options of which one is chosen, or each turned on and off on its own with `multiple`. */
function ToggleGroup(props: SingleToggleGroupProps | MultipleToggleGroupProps) {
  const selection = () =>
    (props.multiple
      ? { multiple: true, value: props.value, onChange: props.onChange }
      : { value: props.value, onChange: props.onChange }) as {
      value: string;
      onChange: (value: string | null) => void;
    };
  return (
    <ToggleGroupPrimitive
      data-slot="toggle-group"
      aria-label={props["aria-label"]}
      {...selection()}
      disabled={props.disabled}
      class={cn("flex w-fit flex-row items-center gap-2", props.class)}
    >
      <ToggleGroupContext
        value={{
          get variant() {
            return props.variant;
          },
          get size() {
            return props.size;
          },
        }}
      >
        {props.children}
      </ToggleGroupContext>
    </ToggleGroupPrimitive>
  );
}

function ToggleGroupItem(props: { value: string; class?: string; children: JSX.Element }) {
  const group = useContext(ToggleGroupContext);
  return (
    <ToggleGroupPrimitive.Item
      data-slot="toggle-group-item"
      value={props.value}
      class={cn(
        "shrink-0 focus:z-10 focus-visible:z-10",
        toggleVariants({ variant: group.variant, size: group.size }),
        props.class
      )}
    >
      {props.children}
    </ToggleGroupPrimitive.Item>
  );
}

export { ToggleGroup, ToggleGroupItem };
