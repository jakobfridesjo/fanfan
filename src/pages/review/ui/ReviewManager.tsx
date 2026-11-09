import { Link } from "@tanstack/react-router";
import { CalendarCheck, Undo2 } from "lucide-react";
import { formatDuration, formatShortDateTime } from "@/shared/lib/date.ts";
import { useMessages } from "@/shared/i18n/messages.ts";
import { cn } from "@/shared/lib/class-names.ts";
import { UnavailableState } from "@/shared/ui/EmptyStates.tsx";
import { PageHeader } from "@/shared/ui/PageHeader.tsx";
import { StudySession, StudySkeleton, StudyStage } from "@/shared/ui/StudySession.tsx";
import { SwipeCard } from "@/shared/ui/SwipeCard.tsx";
import { TooltipIconButton } from "@/shared/ui/TooltipIconButton.tsx";
import { Button, buttonVariants } from "@/shared/ui/shadcn/button.tsx";
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

function ReviewManager() {
  const m = useMessages();
  const {
    loading,
    failed,
    current,
    refilling,
    reviewed,
    remaining,
    nextDueAt,
    revealed,
    reveal,
    rate,
    swipe,
    canUndo,
    undo,
  } = useReviewManager();

  return (
    <>
      <PageHeader title={m.review.title}>
        <TooltipIconButton
          label={m.review.undo}
          tooltip={m.review.undoTooltip}
          variant="outline"
          size="icon"
          onClick={undo}
          disabled={!canUndo}
        >
          <Undo2 />
        </TooltipIconButton>
      </PageHeader>

      <StudyStage status={current && <ReviewProgress reviewed={reviewed} remaining={remaining} />}>
        {loading || refilling ? (
          <StudySkeleton />
        ) : failed ? (
          <UnavailableState description={m.review.loadFailedDescription} />
        ) : current ? (
          <StudySession
            card={
              <SwipeCard
                key={current.word}
                onSwipe={swipe}
                disabled={!revealed}
                className="flex min-h-96 flex-col"
              >
                {revealed ? (
                  <WordCard card={current} />
                ) : (
                  <div
                    role="button"
                    tabIndex={0}
                    aria-label={m.review.showAnswer}
                    className="flex flex-1 cursor-pointer flex-col"
                    onClick={(event) => {
                      if (!(event.target as Element).closest("button")) reveal();
                    }}
                  >
                    <WordCard card={current} hidden hiddenHint={m.review.tapToReveal} />
                  </div>
                )}
              </SwipeCard>
            }
            actions={
              // Laid out while hidden, so revealing the answer moves nothing.
              <div
                inert={!revealed}
                className={cn("grid grid-cols-4 gap-2", !revealed && "invisible")}
              >
                {RATINGS.map((rating) => (
                  <Button
                    key={rating}
                    type="button"
                    variant={rating === 3 ? "default" : "outline"}
                    size="lg"
                    className="h-auto flex-col gap-0 py-1.5"
                    onClick={() => rate(rating)}
                  >
                    {m.review.ratings[rating]}
                    <span className="text-xs font-normal opacity-70">
                      {formatDuration(current.intervals[rating - 1])}
                    </span>
                  </Button>
                ))}
              </div>
            }
          />
        ) : (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CalendarCheck />
              </EmptyMedia>
              <EmptyTitle>{m.review.emptyTitle}</EmptyTitle>
              <EmptyDescription>
                {nextDueAt === null
                  ? m.review.startLearning
                  : m.review.nextReview(formatShortDateTime(new Date(nextDueAt).toISOString()))}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Link to="/library" className={buttonVariants({ variant: "outline" })}>
                {m.review.goToLibrary}
              </Link>
            </EmptyContent>
          </Empty>
        )}
      </StudyStage>
    </>
  );
}

function ReviewProgress({ reviewed, remaining }: { reviewed: number; remaining: number }) {
  const m = useMessages();
  const total = reviewed + remaining;
  return (
    <>
      <div
        role="meter"
        aria-label={m.review.sessionProgress}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={reviewed}
        className="flex h-2 overflow-hidden rounded-full bg-foreground/10"
      >
        <div className="bg-success" style={{ width: `${(reviewed / total) * 100}%` }} />
      </div>
      <p className="text-sm text-muted-foreground">{m.review.due(remaining)}</p>
    </>
  );
}

export default ReviewManager;
