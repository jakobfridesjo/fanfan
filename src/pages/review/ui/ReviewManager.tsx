import { Link } from "@tanstack/solid-router";
import { CalendarCheck, Undo2 } from "lucide";
import { createMemo, For, Match, Show, Switch, untrack } from "solid-js";
import { formatDuration, formatShortDateTime } from "@/shared/lib/date.ts";
import { useMessages } from "@/shared/i18n/messages.ts";
import { cn } from "@/shared/lib/class-names.ts";
import { UnavailableState } from "@/shared/ui/EmptyStates.tsx";
import { Icon } from "@/shared/ui/Icon.tsx";
import { PageHeader } from "@/shared/ui/PageHeader.tsx";
import { StudySession, StudySkeleton, StudyStage } from "@/shared/ui/StudySession.tsx";
import { SwipeCard } from "@/shared/ui/SwipeCard.tsx";
import { TooltipIconButton } from "@/shared/ui/TooltipIconButton.tsx";
import { Button, buttonVariants } from "@/shared/ui/shadcn/button.tsx";
import { Select } from "@/shared/ui/shadcn/select.tsx";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/shared/ui/shadcn/empty.tsx";
import { WordCard } from "@/entities/word/ui/WordCard.tsx";
import { RATINGS, useReviewManager } from "@/pages/review/model/use-review-manager.ts";

interface ReviewManagerProps {
  /** Reviews only this book's due words; null for every due word. */
  documentId: number | null;
  onDocumentChange: (documentId: number | null) => void;
}

const ALL_BOOKS = "all";

function ReviewManager(props: ReviewManagerProps) {
  const m = useMessages();
  // The route mounts a fresh manager per choice of book.
  const review = useReviewManager(untrack(() => props.documentId));
  // A fresh card per word: the last one has flung off-screen.
  const currentWord = createMemo(() => review.current?.word);
  const bookOptions = createMemo(() => [
    { value: ALL_BOOKS, label: m.review.allBooks },
    ...review.documents.map((document) => ({
      value: `${document.id}`,
      label: document.title,
      content: () => <span lang="zh">{document.title}</span>,
    })),
  ]);

  return (
    <>
      <PageHeader
        title={m.review.title}
        centerInline
        center={
          <Show when={review.documents.length > 0}>
            <Select
              aria-label={m.review.book}
              class="max-w-40 sm:max-w-64"
              options={bookOptions()}
              value={props.documentId === null ? ALL_BOOKS : `${props.documentId}`}
              onChange={(value) => {
                if (value !== null)
                  props.onDocumentChange(value === ALL_BOOKS ? null : Number(value));
              }}
            />
          </Show>
        }
        action={
          <TooltipIconButton
            label={m.review.undo}
            tooltip={m.review.undoTooltip}
            variant="outline"
            size="icon"
            onClick={review.undo}
            disabled={!review.canUndo}
          >
            <Icon icon={Undo2} />
          </TooltipIconButton>
        }
      />

      <StudyStage
        status={
          <Show when={review.current}>
            <ReviewProgress reviewed={review.reviewed} remaining={review.remaining} />
          </Show>
        }
      >
        <Switch>
          <Match when={review.loading || review.refilling}>
            <StudySkeleton />
          </Match>
          <Match when={review.failed}>
            <UnavailableState description={m.review.loadFailedDescription} />
          </Match>
          <Match when={review.current}>
            {(current) => (
              <StudySession
                card={
                  <Show when={currentWord()} keyed>
                    {(_word) => (
                      <SwipeCard
                        onSwipe={review.swipe}
                        disabled={!review.revealed}
                        class="flex min-h-96 flex-col"
                      >
                        <Show
                          when={review.revealed}
                          fallback={
                            <div
                              role="button"
                              tabindex={0}
                              aria-label={m.review.showAnswer}
                              class="flex flex-1 cursor-pointer flex-col"
                              onClick={(event) => {
                                if (!event.target.closest("button")) review.reveal();
                              }}
                            >
                              <WordCard card={current()} hidden hiddenHint={m.review.tapToReveal} />
                            </div>
                          }
                        >
                          <WordCard card={current()} />
                        </Show>
                      </SwipeCard>
                    )}
                  </Show>
                }
                actions={
                  // Laid out while hidden, so revealing the answer moves nothing.
                  <div
                    inert={!review.revealed}
                    class={cn("grid grid-cols-4 gap-2", !review.revealed && "invisible")}
                  >
                    <For each={RATINGS}>
                      {(rating) => (
                        <Button
                          variant="outline"
                          size="lg"
                          class="h-auto flex-col gap-0 py-1.5"
                          onClick={() => review.rate(rating)}
                        >
                          {m.review.ratings[rating]}
                          <span class="text-xs font-normal opacity-70">
                            {formatDuration(current().intervals[rating - 1])}
                          </span>
                        </Button>
                      )}
                    </For>
                  </div>
                }
              />
            )}
          </Match>
          <Match when={true}>
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Icon icon={CalendarCheck} />
                </EmptyMedia>
                <EmptyTitle>
                  {props.documentId === null ? m.review.emptyTitle : m.review.emptyInBook}
                </EmptyTitle>
                <EmptyDescription>
                  <Show when={review.nextDueAt} fallback={m.review.startLearning}>
                    {(nextDueAt) =>
                      m.review.nextReview(formatShortDateTime(new Date(nextDueAt()).toISOString()))
                    }
                  </Show>
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Link to="/library" class={buttonVariants({ variant: "outline" })}>
                  {m.review.goToLibrary}
                </Link>
              </EmptyContent>
            </Empty>
          </Match>
        </Switch>
      </StudyStage>
    </>
  );
}

function ReviewProgress(props: { reviewed: number; remaining: number }) {
  const m = useMessages();
  const total = () => props.reviewed + props.remaining;
  return (
    <div class="flex items-center gap-3">
      <div
        role="meter"
        aria-label={m.review.sessionProgress}
        aria-valuemin={0}
        aria-valuemax={total()}
        aria-valuenow={props.reviewed}
        class="flex h-2 flex-1 overflow-hidden rounded-full bg-foreground/10"
      >
        <div class="bg-success" style={{ width: `${(props.reviewed / total()) * 100}%` }} />
      </div>
      <p class="shrink-0 text-sm text-muted-foreground">{m.review.due(props.remaining)}</p>
    </div>
  );
}

export default ReviewManager;
