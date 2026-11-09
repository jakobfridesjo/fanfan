import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useSelector } from "@tanstack/react-store";
import {
  commandErrorMessage,
  commands,
  type Rating,
  type ReviewSnapshot,
} from "@/shared/api/commands.ts";
import { reviewQueueQuery } from "@/shared/api/queries.ts";
import { scriptAtom } from "@/shared/config/preferences.ts";
import { useMessages } from "@/shared/i18n/messages.ts";
import { actionToasts } from "@/shared/lib/toast.ts";
import { useAnswerHistory } from "@/shared/lib/use-answer-history.ts";
import { useKeyBindings } from "@/shared/lib/use-key-bindings.ts";
import { useQueryErrorToast } from "@/shared/lib/use-query-error-toast.ts";
import type { SwipeDirection } from "@/shared/ui/SwipeCard.tsx";

const reviewToast = actionToasts("review-action");

export const RATINGS: Rating[] = [1, 2, 3, 4];

/** Once the answer shows, a swipe left is "again" and right is "good". */
const SWIPE_RATING: Record<SwipeDirection, Rating> = { left: 1, right: 3 };

export function useReviewManager() {
  const m = useMessages();
  const script = useSelector(scriptAtom);
  const queue = useQuery(reviewQueueQuery(script));
  useQueryErrorToast(queue.error ? m.review.loadFailed : null, "review-query");

  const history = useAnswerHistory<ReviewSnapshot>();
  const [revealed, setRevealed] = useState(false);

  const reviewMutation = useMutation({
    mutationFn: ({ word, rating }: { word: string; rating: Rating }) =>
      commands.reviewWord(word, rating),
    meta: { changesStudyData: true },
    onMutate: ({ word }) => {
      history.hide(word);
      setRevealed(false);
    },
    onSuccess: history.remember,
    onError: (error) => reviewToast.error(commandErrorMessage(error, m.review.saveFailed)),
    onSettled: (_result, _error, { word }) => history.show(word),
  });

  // The undone word was the most overdue, so the refetched queue shows it first again.
  const undoMutation = useMutation({
    mutationFn: commands.undoReview,
    meta: { changesStudyData: true },
    onMutate: (snapshot) => {
      history.forget(snapshot);
      setRevealed(false);
    },
    onError: (error, snapshot) => {
      history.remember(snapshot);
      reviewToast.error(commandErrorMessage(error, m.review.undoFailed));
    },
  });

  const cards = (queue.data?.cards ?? []).filter((card) => !history.pending.has(card.word));
  const current = cards.at(0) ?? null;

  const rate = (rating: Rating) => {
    if (current && revealed) reviewMutation.mutate({ word: current.word, rating });
  };

  const reveal = () => setRevealed(true);

  const lastReview = history.lastAnswer;
  const undo = () => {
    if (!lastReview || undoMutation.isPending) return;
    undoMutation.mutate(lastReview);
  };

  const swipe = (direction: SwipeDirection) => rate(SWIPE_RATING[direction]);

  useKeyBindings({
    " ": reveal,
    Enter: reveal,
    "1": () => rate(1),
    "2": () => rate(2),
    "3": () => rate(3),
    "4": () => rate(4),
    ArrowLeft: () => rate(1),
    ArrowRight: () => rate(3),
    Backspace: undo,
    z: undo,
  });

  return {
    loading: queue.isLoading,
    failed: queue.isError,
    current,
    refilling: !current && queue.isFetching,
    reviewed: history.answered,
    remaining: Math.max((queue.data?.dueCount ?? 0) - history.pending.size, 0),
    nextDueAt: queue.data?.nextDueAt ?? null,
    revealed,
    reveal,
    rate,
    swipe,
    canUndo: lastReview !== null && !undoMutation.isPending,
    undo,
  };
}
