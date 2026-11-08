import type { ReactNode } from "react";
import { Link, useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { AlertCircle, FileQuestion } from "lucide-react";
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

function Fallback({
  icon,
  title,
  description,
  action,
  destructive = false,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action: ReactNode;
  destructive?: boolean;
}) {
  return (
    <CenteredEmpty className="min-h-[60vh] p-5">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon" className={destructive ? "text-destructive" : undefined}>
            {icon}
          </EmptyMedia>
          <EmptyTitle>{title}</EmptyTitle>
          <EmptyDescription>{description}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>{action}</EmptyContent>
      </Empty>
    </CenteredEmpty>
  );
}

export function NotFoundFallback() {
  const m = useMessages();
  return (
    <Fallback
      icon={<FileQuestion />}
      title={m.fallback.notFoundTitle}
      description={m.fallback.notFoundDescription}
      action={
        <Link to="/" className={buttonVariants()}>
          {m.fallback.goHome}
        </Link>
      }
    />
  );
}

export function RouteErrorFallback({ error }: ErrorComponentProps) {
  const m = useMessages();
  const router = useRouter();
  // oxlint-disable-next-line no-console
  console.error("[Route Error]", error);

  return (
    <Fallback
      destructive
      icon={<AlertCircle />}
      title={m.fallback.errorTitle}
      description={m.fallback.routeError}
      action={<Button onClick={() => void router.invalidate()}>{m.common.tryAgain}</Button>}
    />
  );
}

export function AppCrashFallback({ error }: { error: Error | null }) {
  const m = useMessages();
  // oxlint-disable-next-line no-console
  console.error("[React Render Error]", error);

  return (
    <Fallback
      destructive
      icon={<AlertCircle />}
      title={m.fallback.errorTitle}
      description={m.fallback.crash}
      action={<Button onClick={() => window.location.reload()}>{m.fallback.reload}</Button>}
    />
  );
}
