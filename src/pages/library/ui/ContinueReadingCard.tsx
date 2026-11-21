import { Link } from "@tanstack/solid-router";
import { BookOpen } from "lucide";
import type { DocumentSummary } from "@/shared/api/commands.ts";
import { useMessages } from "@/shared/i18n/messages.ts";
import { Icon } from "@/shared/ui/Icon.tsx";
import { buttonVariants } from "@/shared/ui/shadcn/button.tsx";
import { Card, CardContent } from "@/shared/ui/shadcn/card.tsx";
import { DocumentCover } from "@/entities/document/ui/DocumentCover.tsx";

/** The book read last, and a way back to where it was left. */
export function ContinueReadingCard(props: { document: DocumentSummary }) {
  const m = useMessages();
  return (
    <Card size="sm" class="shrink-0">
      <CardContent class="flex items-center gap-4">
        <div class="aspect-[2/3] w-12 shrink-0 overflow-hidden rounded-md bg-muted">
          <DocumentCover document={props.document} thumbnail />
        </div>
        <div class="flex min-w-0 flex-1 flex-col gap-0.5">
          <span lang="zh" class="truncate font-medium">
            {props.document.title}
          </span>
          <span class="text-sm text-muted-foreground">
            {m.library.chapterOf(props.document.readingSection + 1, props.document.sectionCount)}
          </span>
        </div>
        <Link
          to="/read/$documentId"
          params={{ documentId: props.document.id }}
          class={buttonVariants({ className: "shrink-0" })}
        >
          <Icon icon={BookOpen} data-icon="inline-start" />
          {m.library.continueReading}
        </Link>
      </CardContent>
    </Card>
  );
}
