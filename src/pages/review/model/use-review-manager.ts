import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSelector } from "@tanstack/react-store";
import {
  commandErrorMessage,
  commands,
  type Rating,
  type ReviewSnapshot,
} from "@/shared/api/commands.ts";
import { invalidateStudyData, reviewQueueQuery } from "@/shared/api/queries.ts";
import { scriptAtom } from "@/shared/config/preferences.ts";
import { useMessages } from "@/shared/i18n/messages.ts";
import { actionToasts } from "@/shared/lib/toast.ts";
import { useKeyBindings } from "@/shared/lib/use-key-bindings.ts";
import { useQueryErrorToast } from "@/shared/lib/use-query-error-toast.ts";
import type { SwipeDirection } from "@/shared/ui/SwipeCard.tsx";

const reviewToast = actionToasts("review-action");

export const RATINGS: Rating[] = [1, 2, 3, 4];

/** Once the answer shows, a swipe left is "again" and right is "good". */
const SWIPE_RATING: Record<SwipeDirection, Rating> = { left: 1, right: 3 };

export function useReviewManager() {
  const queryClient = useQueryClient();
  const m = useMessages();
  const script = useSelector(scriptAtom);
  const queue = useQuery(reviewQueueQuery(script));
  useQueryErrorToast(queue.error ? m.review.loadFailed : null, "review-query");

  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const [revealed, setRevealed] = useState(false);
  const [undoStack, setUndoStack] = useState<ReviewSnapshot[]>([]);

  const reviewMutation = useMutation({
    mutationFn: ({ word, rating }: { word: string; rating: Rating }) =>
      commands.reviewWord(word, rating),
    onMutate: ({ word }) => {
      setPending((words) => new Set(words).add(word));
      setRevealed(false);
    },
    onSuccess: (snapshot) => setUndoStack((stack) => [...stack, snapshot]),
    onError: (error) => reviewToast.error(commandErrorMessage(error, m.review.saveFailed)),
    onSettled: async (_result, _error, { word }) => {
      await invalidateStudyData(queryClient);
      setPending((words) => {
        const next = new Set(words);
        next.delete(word);
        return next;
      });
    },
  });

  // The undone word was the most overdue, so the refetched queue shows it first again.
  const undoMutation = useMutation({
    mutationFn: commands.undoReview,
    onMutate: (snapshot) => {
      setUndoStack((stack) => stack.filter((entry) => entry !== snapshot));
      setRevealed(false);
    },
    onError: (error, snapshot) => {
      setUndoStack((stack) => [...stack, snapshot]);
      reviewToast.error(commandErrorMessage(error, m.review.undoFailed));
    },
    onSettled: () => invalidateStudyData(queryClient),
  });

  const cards = (queue.data?.cards ?? []).filter((card) => !pending.has(card.word));
  const current = cards.at(0) ?? null;

  const rate = (rating: Rating) => {
    if (current && revealed) reviewMutation.mutate({ word: current.word, rating });
  };

  const reveal = () => setRevealed(true);

  const lastReview = undoStack.at(-1) ?? null;
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
    remaining: Math.max((queue.data?.dueCount ?? 0) - pending.size, 0),
    nextDueAt: queue.data?.nextDueAt ?? null,
    revealed,
    reveal,
    rate,
    swipe,
    canUndo: lastReview !== null && !undoMutation.isPending,
    undo,
  };
}
