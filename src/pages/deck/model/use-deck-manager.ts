import { onFlush } from "solid-js";
import { useMutation } from "@tanstack/solid-query";
import {
  commandErrorMessage,
  commands,
  type WordSnapshot,
  type WordStatus,
} from "@/shared/api/commands.ts";
import { deckQuery, useCommandQuery } from "@/shared/api/queries.ts";
import { scriptAtom } from "@/shared/config/preferences.ts";
import { useMessages } from "@/shared/i18n/messages.ts";
import { actionToasts } from "@/shared/lib/toast.ts";
import { useAnswerHistory } from "@/shared/lib/use-answer-history.ts";
import { useKeyBindings } from "@/shared/lib/use-key-bindings.ts";
import { useQueryErrorToast } from "@/shared/lib/use-query-error-toast.ts";
import type { SwipeDirection } from "@/shared/ui/SwipeCard.tsx";

const deckToast = actionToasts("deck-action");

/** Swiping right means "I know this word"; left means "teach me". */
const SWIPE_STATUS: Record<SwipeDirection, WordStatus> = {
  right: "known",
  left: "learning",
};

export function useDeckManager(documentId: number) {
  const m = useMessages();
  const deck = useCommandQuery(() => deckQuery(documentId, scriptAtom()));
  useQueryErrorToast(() => (deck.isError ? m.deck.loadFailed : null), "deck-query");

  // Words answered but not yet gone from the refetched deck are hidden meanwhile.
  const history = useAnswerHistory<WordSnapshot>();

  const statusMutation = useMutation(() => ({
    mutationFn: ({ word, status }: { word: string; status: WordStatus }) =>
      commands.setWordStatus(word, status),
    meta: { changesStudyData: true as const },
    // A mutation holds what it writes until it settles; the word hides at once.
    onMutate: ({ word }) => onFlush(() => history.hide(word)),
    onSuccess: (snapshot) => void history.remember(snapshot),
    onError: (error) => deckToast.error(commandErrorMessage(error, m.deck.saveFailed)),
    onSettled: (_snapshot, _error, { word }) => void history.show(word),
  }));

  const undoMutation = useMutation(() => ({
    mutationFn: commands.restoreWord,
    meta: { changesStudyData: true as const },
    onMutate: (snapshot) => onFlush(() => history.forget(snapshot)),
    onError: (error, snapshot) => {
      history.remember(snapshot);
      deckToast.error(commandErrorMessage(error, m.deck.undoFailed));
    },
  }));

  const current = () =>
    (deck.data?.cards ?? []).find((card) => !history.pending.has(card.word)) ?? null;

  const answer = (direction: SwipeDirection) => {
    const card = current();
    if (!card) return;
    void statusMutation.mutate({ word: card.word, status: SWIPE_STATUS[direction] });
  };

  const undo = () => {
    const lastAnswer = history.lastAnswer;
    if (!lastAnswer || undoMutation.isPending) return;
    void undoMutation.mutate(lastAnswer);
  };

  useKeyBindings(() => ({
    ArrowLeft: () => answer("left"),
    ArrowRight: () => answer("right"),
    Backspace: undo,
    z: undo,
  }));

  return {
    get deck() {
      return deck.data;
    },
    get loading() {
      return deck.isLoading;
    },
    get failed() {
      return deck.isError;
    },
    get current() {
      return current();
    },
    /** A deck refetch is still loading the next batch: not the end of the book. */
    get refilling() {
      return !current() && deck.isFetching;
    },
    answer,
    get canUndo() {
      return history.lastAnswer !== null && !undoMutation.isPending;
    },
    undo,
  };
}
