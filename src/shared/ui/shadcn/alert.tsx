import type { ComponentProps } from "@solidjs/web";
import { omit } from "solid-js";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/shared/lib/class-names.ts";

const alertVariants = cva(
  "group/alert relative grid w-full gap-0.5 rounded-2xl border px-4 py-3 text-left text-sm has-data-[slot=alert-action]:relative has-data-[slot=alert-action]:pr-18 has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-2.5 *:[svg]:row-span-2 *:[svg]:translate-y-0.5 *:[svg]:text-current *:[svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground",
        destructive:
          "bg-card text-destructive *:data-[slot=alert-description]:text-destructive/90 *:[svg]:text-current",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

type DivProps = Omit<ComponentProps<"div">, "class"> & { class?: string };

function Alert(props: DivProps & VariantProps<typeof alertVariants>) {
  const rest = omit(props, "class", "variant");
  return (
    <div
      data-slot="alert"
      role="alert"
      {...rest}
      class={cn(alertVariants({ variant: props.variant }), props.class)}
    />
  );
}

function AlertDescription(props: DivProps) {
  const rest = omit(props, "class");
  return (
    <div
      data-slot="alert-description"
      {...rest}
      class={cn(
        "text-sm text-balance text-muted-foreground md:text-pretty [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground [&_p:not(:last-child)]:mb-4",
        props.class
      )}
    />
  );
}

export { Alert, AlertDescription };
