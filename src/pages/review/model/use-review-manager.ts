import { createSignal, onFlush } from "solid-js";
import { useMutation } from "@tanstack/solid-query";
import {
  commandErrorMessage,
  commands,
  type Rating,
  type ReviewSnapshot,
} from "@/shared/api/commands.ts";
import { documentsQuery, reviewQueueQuery, useCommandQuery } from "@/shared/api/queries.ts";
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

/** With a `documentId`, reviews only the due words in that book. */
export function useReviewManager(documentId: number | null) {
  const m = useMessages();
  const queue = useCommandQuery(() => reviewQueueQuery(scriptAtom(), documentId));
  const documents = useCommandQuery(() => documentsQuery());
  useQueryErrorToast(() => (queue.isError ? m.review.loadFailed : null), "review-query");

  const history = useAnswerHistory<ReviewSnapshot>();
  // Kept beside the signal: a key press right after revealing must already see it.
  let isRevealed = false;
  const [revealed, setRevealedSignal] = createSignal(false);
  const setRevealed = (next: boolean) => {
    isRevealed = next;
    setRevealedSignal(next);
  };

  const reviewMutation = useMutation(() => ({
    mutationFn: ({ word, rating }: { word: string; rating: Rating }) =>
      commands.reviewWord(word, rating),
    meta: { changesStudyData: true as const },
    // A mutation holds what it writes until it settles; the card hides at once.
    onMutate: ({ word }) =>
      onFlush(() => {
        history.hide(word);
        setRevealed(false);
      }),
    onSuccess: (snapshot) => void history.remember(snapshot),
    onError: (error) => reviewToast.error(commandErrorMessage(error, m.review.saveFailed)),
    onSettled: (_result, _error, { word }) => void history.show(word),
  }));

  // The undone word was the most overdue, so the refetched queue shows it first again.
  const undoMutation = useMutation(() => ({
    mutationFn: commands.undoReview,
    meta: { changesStudyData: true as const },
    onMutate: (snapshot) =>
      onFlush(() => {
        history.forget(snapshot);
        setRevealed(false);
      }),
    onError: (error, snapshot) => {
      history.remember(snapshot);
      reviewToast.error(commandErrorMessage(error, m.review.undoFailed));
    },
  }));

  const current = () =>
    (queue.data?.cards ?? []).find((card) => !history.pending.has(card.word)) ?? null;

  const rate = (rating: Rating) => {
    const card = current();
    if (card && isRevealed) void reviewMutation.mutate({ word: card.word, rating });
  };

  const reveal = () => setRevealed(true);

  const undo = () => {
    const lastReview = history.lastAnswer;
    if (!lastReview || undoMutation.isPending) return;
    void undoMutation.mutate(lastReview);
  };

  const swipe = (direction: SwipeDirection) => rate(SWIPE_RATING[direction]);

  useKeyBindings(() => ({
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
  }));

  return {
    /** The books to choose from. */
    get documents() {
      return documents.data ?? [];
    },
    get loading() {
      return queue.isLoading;
    },
    get failed() {
      return queue.isError;
    },
    get current() {
      return current();
    },
    get refilling() {
      return !current() && queue.isFetching;
    },
    get reviewed() {
      return history.answered;
    },
    get remaining() {
      return Math.max((queue.data?.dueCount ?? 0) - history.pending.size, 0);
    },
    get nextDueAt() {
      return queue.data?.nextDueAt ?? null;
    },
    get revealed() {
      return revealed();
    },
    reveal,
    rate,
    swipe,
    get canUndo() {
      return history.lastAnswer !== null && !undoMutation.isPending;
    },
    undo,
  };
}
