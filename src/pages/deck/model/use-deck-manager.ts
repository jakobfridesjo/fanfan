import { useMutation, useQuery } from "@tanstack/react-query";
import { useSelector } from "@tanstack/react-store";
import {
  commandErrorMessage,
  commands,
  type WordSnapshot,
  type WordStatus,
} from "@/shared/api/commands.ts";
import { deckQuery } from "@/shared/api/queries.ts";
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
  const script = useSelector(scriptAtom);
  const deck = useQuery(deckQuery(documentId, script));
  useQueryErrorToast(deck.error ? m.deck.loadFailed : null, "deck-query");

  // Words answered but not yet gone from the refetched deck are hidden meanwhile.
  const history = useAnswerHistory<WordSnapshot>();

  const statusMutation = useMutation({
    mutationFn: ({ word, status }: { word: string; status: WordStatus }) =>
      commands.setWordStatus(word, status),
    meta: { changesStudyData: true },
    onMutate: ({ word }) => history.hide(word),
    onSuccess: history.remember,
    onError: (error) => deckToast.error(commandErrorMessage(error, m.deck.saveFailed)),
    onSettled: (_snapshot, _error, { word }) => history.show(word),
  });

  const undoMutation = useMutation({
    mutationFn: commands.restoreWord,
    meta: { changesStudyData: true },
    onMutate: history.forget,
    onError: (error, snapshot) => {
      history.remember(snapshot);
      deckToast.error(commandErrorMessage(error, m.deck.undoFailed));
    },
  });

  const cards = (deck.data?.cards ?? []).filter((card) => !history.pending.has(card.word));
  const current = cards.at(0) ?? null;
  const lastAnswer = history.lastAnswer;

  const answer = (direction: SwipeDirection) => {
    if (!current) return;
    statusMutation.mutate({ word: current.word, status: SWIPE_STATUS[direction] });
  };

  const undo = () => {
    if (!lastAnswer || undoMutation.isPending) return;
    undoMutation.mutate(lastAnswer);
  };

  useKeyBindings({
    ArrowLeft: () => answer("left"),
    ArrowRight: () => answer("right"),
    Backspace: undo,
    z: undo,
  });

  return {
    deck: deck.data,
    loading: deck.isLoading,
    failed: deck.isError,
    current,
    // A deck refetch is still loading the next batch: not the end of the book.
    refilling: !current && deck.isFetching,
    answer,
    canUndo: lastAnswer !== null && !undoMutation.isPending,
    undo,
  };
}
