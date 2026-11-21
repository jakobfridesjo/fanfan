import type { ComponentProps } from "@solidjs/web";
import { omit } from "solid-js";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/shared/lib/class-names.ts";

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-2xl border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        secondary: "bg-secondary text-secondary-foreground",
        outline: "border-border text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

type BadgeProps = Omit<ComponentProps<"span">, "class"> &
  VariantProps<typeof badgeVariants> & { class?: string };

function Badge(props: BadgeProps) {
  const rest = omit(props, "class", "variant");
  return (
    <span
      data-slot="badge"
      {...rest}
      class={cn(badgeVariants({ variant: props.variant }), props.class)}
    />
  );
}

export { Badge };
