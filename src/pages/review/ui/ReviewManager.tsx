import { Link } from "@tanstack/react-router";
import { CalendarCheck } from "lucide-react";
import { formatShortDateTime } from "@/shared/lib/date.ts";
import { useMessages } from "@/shared/i18n/messages.ts";
import { UnavailableState } from "@/shared/ui/EmptyStates.tsx";
import { PageHeader } from "@/shared/ui/PageHeader.tsx";
import { SwipeCard } from "@/shared/ui/SwipeCard.tsx";
import { Button, buttonVariants } from "@/shared/ui/shadcn/button.tsx";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/shared/ui/shadcn/empty.tsx";
import { Skeleton } from "@/shared/ui/shadcn/skeleton.tsx";
import { WordCard } from "@/entities/word/ui/WordCard.tsx";
import { RATINGS, useReviewManager } from "@/pages/review/model/use-review-manager.ts";

function ReviewManager() {
  const m = useMessages();
  const {
    loading,
    failed,
    current,
    refilling,
    remaining,
    nextDueAt,
    revealed,
    reveal,
    rate,
    swipe,
  } = useReviewManager();

  return (
    <>
      <PageHeader title={m.review.title}>
        {remaining > 0 && (
          <span className="text-sm text-muted-foreground">{m.review.due(remaining)}</span>
        )}
      </PageHeader>

      <div className="-m-1 flex min-h-0 flex-col items-center gap-6 overflow-x-hidden overflow-y-auto p-1">
        {loading || refilling ? (
          <Skeleton className="h-96 w-full max-w-xl rounded-3xl motion-reduce:animate-none" />
        ) : failed ? (
          <UnavailableState description={m.review.loadFailedDescription} />
        ) : current ? (
          <div className="flex w-full max-w-xl flex-col gap-4">
            <SwipeCard key={current.word} onSwipe={swipe} disabled={!revealed}>
              <WordCard card={current} hidden={!revealed} onReveal={reveal} />
            </SwipeCard>
            {revealed ? (
              <div className="grid grid-cols-4 gap-2">
                {RATINGS.map((rating) => (
                  <Button
                    key={rating}
                    type="button"
                    variant={rating === 3 ? "default" : "outline"}
                    onClick={() => rate(rating)}
                  >
                    {m.review.ratings[rating]}
                  </Button>
                ))}
              </div>
            ) : (
              <Button type="button" size="lg" onClick={reveal}>
                {m.review.showAnswer}
              </Button>
            )}
            <p className="text-center text-xs text-muted-foreground">
              {revealed ? m.review.rateHint : m.review.recallHint}
            </p>
          </div>
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
      </div>
    </>
  );
}

export default ReviewManager;
