import type { ComponentProps } from "@solidjs/web";
import { For, Match, omit, Show, Switch } from "solid-js";
import { cn } from "@/shared/lib/class-names.ts";

type DivProps = Omit<ComponentProps<"div">, "class"> & { class?: string };

function FieldGroup(props: DivProps) {
  const rest = omit(props, "class");
  return (
    <div
      data-slot="field-group"
      {...rest}
      class={cn(
        "group/field-group @container/field-group flex w-full flex-col gap-6 *:data-[slot=field-group]:gap-4",
        props.class
      )}
    />
  );
}

function Field(props: DivProps & { invalid?: boolean }) {
  const rest = omit(props, "class", "invalid");
  return (
    <div
      role="group"
      data-slot="field"
      data-orientation="vertical"
      data-invalid={props.invalid ? "true" : "false"}
      {...rest}
      class={cn(
        "group/field flex w-full flex-col gap-3 *:w-full data-[invalid=true]:text-destructive [&>.sr-only]:w-auto",
        props.class
      )}
    />
  );
}

function FieldContent(props: DivProps) {
  const rest = omit(props, "class");
  return (
    <div
      data-slot="field-content"
      {...rest}
      class={cn("group/field-content flex flex-1 flex-col gap-1 leading-snug", props.class)}
    />
  );
}

function FieldLabel(props: Omit<ComponentProps<"label">, "class"> & { class?: string }) {
  const rest = omit(props, "class");
  return (
    <label
      data-slot="field-label"
      {...rest}
      class={cn(
        "flex w-fit items-center gap-2 text-sm leading-snug font-medium select-none",
        props.class
      )}
    />
  );
}

function FieldDescription(props: Omit<ComponentProps<"p">, "class"> & { class?: string }) {
  const rest = omit(props, "class");
  return (
    <p
      data-slot="field-description"
      {...rest}
      class={cn("text-left text-sm leading-normal font-normal text-muted-foreground", props.class)}
    />
  );
}

/** The field's errors, each message once; nothing while there are none. */
function FieldError(props: { errors: { message: string }[]; class?: string }) {
  const messages = () => [...new Set(props.errors.map((error) => error.message))];
  return (
    <Show when={messages().length > 0}>
      <div
        role="alert"
        data-slot="field-error"
        class={cn("text-sm font-normal text-destructive", props.class)}
      >
        <Switch>
          <Match when={messages().length === 1}>{messages()[0]}</Match>
          <Match when={messages().length > 1}>
            <ul class="ml-4 flex list-disc flex-col gap-1">
              <For each={messages()}>{(message) => <li>{message}</li>}</For>
            </ul>
          </Match>
        </Switch>
      </div>
    </Show>
  );
}

export { Field, FieldLabel, FieldDescription, FieldError, FieldGroup, FieldContent };
