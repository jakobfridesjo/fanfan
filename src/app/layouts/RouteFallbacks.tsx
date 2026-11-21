import type { JSX } from "@solidjs/web";
import { Link, useRouter, type ErrorComponentProps } from "@tanstack/solid-router";
import { CircleAlert, FileQuestionMark } from "lucide";
import { Button, buttonVariants } from "@/shared/ui/shadcn/button.tsx";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/shared/ui/shadcn/empty.tsx";
import { useMessages } from "@/shared/i18n/messages.ts";
import { CenteredEmpty } from "@/shared/ui/EmptyStates.tsx";
import { Icon } from "@/shared/ui/Icon.tsx";

function Fallback(props: {
  icon: JSX.Element;
  title: string;
  description: string;
  action: JSX.Element;
  destructive?: boolean;
}) {
  return (
    <CenteredEmpty class="min-h-[60vh] p-5">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon" class={props.destructive ? "text-destructive" : undefined}>
            {props.icon}
          </EmptyMedia>
          <EmptyTitle>{props.title}</EmptyTitle>
          <EmptyDescription>{props.description}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>{props.action}</EmptyContent>
      </Empty>
    </CenteredEmpty>
  );
}

export function NotFoundFallback() {
  const m = useMessages();
  return (
    <Fallback
      icon={<Icon icon={FileQuestionMark} />}
      title={m.fallback.notFoundTitle}
      description={m.fallback.notFoundDescription}
      action={
        <Link to="/" class={buttonVariants()}>
          {m.fallback.goHome}
        </Link>
      }
    />
  );
}

export function RouteErrorFallback(props: ErrorComponentProps) {
  const m = useMessages();
  const router = useRouter();
  // oxlint-disable-next-line no-console
  console.error("[Route Error]", props.error);

  return (
    <Fallback
      destructive
      icon={<Icon icon={CircleAlert} />}
      title={m.fallback.errorTitle}
      description={m.fallback.routeError}
      action={<Button onClick={() => void router.invalidate()}>{m.common.tryAgain}</Button>}
    />
  );
}

export function AppCrashFallback(props: { error: unknown }) {
  const m = useMessages();
  // oxlint-disable-next-line no-console
  console.error("[Render Error]", props.error);

  return (
    <Fallback
      destructive
      icon={<Icon icon={CircleAlert} />}
      title={m.fallback.errorTitle}
      description={m.fallback.crash}
      action={<Button onClick={() => window.location.reload()}>{m.fallback.reload}</Button>}
    />
  );
}
