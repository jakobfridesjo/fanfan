import type { ReactNode } from "react";
import { Card, CardContent } from "@/shared/ui/shadcn/card.tsx";
import { Skeleton } from "@/shared/ui/shadcn/skeleton.tsx";

/** The scrolling column of a swipe-card page: a progress panel above whatever the session shows. */
export function StudyStage({ status, children }: { status?: ReactNode; children: ReactNode }) {
  return (
    <div className="-m-1 flex min-h-0 flex-1 flex-col items-center gap-4 overflow-x-hidden overflow-y-auto p-1">
      {status && (
        <Card size="sm" className="w-full max-w-xl shrink-0">
          <CardContent className="flex flex-col gap-2">{status}</CardContent>
        </Card>
      )}
      {children}
    </div>
  );
}

export function StudySkeleton() {
  return <Skeleton className="h-96 w-full max-w-xl rounded-3xl motion-reduce:animate-none" />;
}

/** The current card centred in the free space, with its answer buttons and any keyboard hint below. */
export function StudySession({
  card,
  actions,
  hint,
}: {
  card: ReactNode;
  actions: ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex min-h-0 w-full max-w-xl flex-1 flex-col gap-4 pb-2">
      <div className="flex min-h-0 flex-1 flex-col justify-center">{card}</div>
      {actions}
      {hint && <p className="text-center text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
