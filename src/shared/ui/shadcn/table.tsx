import type { ComponentProps } from "@solidjs/web";
import { omit } from "solid-js";
import { cn } from "@/shared/lib/class-names.ts";

type Classed<T extends "table" | "thead" | "tr" | "th" | "td"> = Omit<
  ComponentProps<T>,
  "class"
> & { class?: string };

function Table(props: Classed<"table">) {
  const rest = omit(props, "class");
  return (
    <div data-slot="table-container" class="relative w-full overflow-x-auto">
      <table data-slot="table" {...rest} class={cn("w-full caption-bottom text-sm", props.class)} />
    </div>
  );
}

function TableHeader(props: Classed<"thead">) {
  const rest = omit(props, "class");
  return <thead data-slot="table-header" {...rest} class={cn("[&_tr]:border-b", props.class)} />;
}

function TableRow(props: Classed<"tr">) {
  const rest = omit(props, "class");
  return (
    <tr
      data-slot="table-row"
      {...rest}
      class={cn("border-b transition-colors hover:bg-muted/50", props.class)}
    />
  );
}

function TableHead(props: Classed<"th">) {
  const rest = omit(props, "class");
  return (
    <th
      data-slot="table-head"
      {...rest}
      class={cn(
        "h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground",
        props.class
      )}
    />
  );
}

function TableCell(props: Classed<"td">) {
  const rest = omit(props, "class");
  return (
    <td
      data-slot="table-cell"
      {...rest}
      class={cn("p-2 align-middle whitespace-nowrap", props.class)}
    />
  );
}

export { Table, TableHeader, TableHead, TableRow, TableCell };
