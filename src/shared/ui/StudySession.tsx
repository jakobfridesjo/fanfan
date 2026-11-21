import type { JSX } from "@solidjs/web";
import { Show } from "solid-js";
import { Card, CardContent } from "@/shared/ui/shadcn/card.tsx";
import { Skeleton } from "@/shared/ui/shadcn/skeleton.tsx";

/** The scrolling column of a swipe-card page: a progress panel above whatever the session shows. */
export function StudyStage(props: { status?: JSX.Element; children: JSX.Element }) {
  return (
    <div class="-m-1 flex min-h-0 flex-1 flex-col items-center gap-4 overflow-x-hidden overflow-y-auto p-1 scroll-fade">
      <Show when={props.status}>
        <Card size="sm" class="w-full max-w-xl shrink-0">
          <CardContent class="flex flex-col gap-2">{props.status}</CardContent>
        </Card>
      </Show>
      {props.children}
    </div>
  );
}

export function StudySkeleton() {
  return <Skeleton class="h-96 w-full max-w-xl rounded-3xl motion-reduce:animate-none" />;
}

/** The current card centred in the free space, with its answer buttons and any keyboard hint below. */
export function StudySession(props: { card: JSX.Element; actions: JSX.Element; hint?: string }) {
  return (
    <div class="flex min-h-0 w-full max-w-xl flex-1 flex-col gap-4 pb-2">
      <div class="flex min-h-0 flex-1 flex-col justify-center">{props.card}</div>
      {props.actions}
      <Show when={props.hint}>
        <p class="text-center text-xs text-muted-foreground">{props.hint}</p>
      </Show>
    </div>
  );
}
