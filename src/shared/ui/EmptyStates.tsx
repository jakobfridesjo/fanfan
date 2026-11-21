import type { JSX } from "@solidjs/web";
import { Show } from "solid-js";
import { useMessages } from "@/shared/i18n/messages.ts";
import { cn } from "@/shared/lib/class-names.ts";
import { Button } from "@/shared/ui/shadcn/button.tsx";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/shared/ui/shadcn/empty.tsx";

export function CenteredEmpty(props: { children: JSX.Element; class?: string }) {
  return (
    <div class={cn("flex flex-1 items-center justify-center", props.class)}>{props.children}</div>
  );
}

interface UnavailableStateProps {
  title?: string;
  description: string;
  onRetry?: () => void;
  size?: "default" | "sm";
}

export function UnavailableState(props: UnavailableStateProps) {
  const m = useMessages();
  return (
    <Empty>
      <EmptyHeader>
        <Show when={props.title}>
          <EmptyTitle>{props.title}</EmptyTitle>
        </Show>
        <EmptyDescription>{props.description}</EmptyDescription>
      </EmptyHeader>
      <Show when={props.onRetry}>
        <EmptyContent>
          <Button variant="outline" size={props.size} onClick={() => props.onRetry?.()}>
            {m.common.tryAgain}
          </Button>
        </EmptyContent>
      </Show>
    </Empty>
  );
}
