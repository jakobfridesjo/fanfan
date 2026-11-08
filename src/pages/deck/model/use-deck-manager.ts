import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSelector } from "@tanstack/react-store";
import {
  commandErrorMessage,
  commands,
  type WordSnapshot,
  type WordStatus,
} from "@/shared/api/commands.ts";
import { deckQuery, invalidateStudyData } from "@/shared/api/queries.ts";
import { scriptAtom } from "@/shared/config/preferences.ts";
import { useMessages } from "@/shared/i18n/messages.ts";
import { actionToasts } from "@/shared/lib/toast.ts";
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
  const queryClient = useQueryClient();
  const m = useMessages();
  const script = useSelector(scriptAtom);
  const deck = useQuery(deckQuery(documentId, script));
  useQueryErrorToast(deck.error ? m.deck.loadFailed : null, "deck-query");

  // Words answered but not yet gone from the refetched deck, hidden meanwhile.
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const [undoStack, setUndoStack] = useState<WordSnapshot[]>([]);

  const hide = (word: string) => setPending((words) => new Set(words).add(word));
  const show = (word: string) =>
    setPending((words) => {
      const next = new Set(words);
      next.delete(word);
      return next;
    });

  const statusMutation = useMutation({
    mutationFn: ({ word, status }: { word: string; status: WordStatus }) =>
      commands.setWordStatus(word, status),
    onMutate: ({ word }) => hide(word),
    onSuccess: (snapshot) => setUndoStack((stack) => [...stack, snapshot]),
    onError: (error) => deckToast.error(commandErrorMessage(error, m.deck.saveFailed)),
    onSettled: async (_snapshot, _error, { word }) => {
      await invalidateStudyData(queryClient);
      show(word);
    },
  });

  const undoMutation = useMutation({
    mutationFn: commands.restoreWord,
    onMutate: (snapshot) => setUndoStack((stack) => stack.filter((entry) => entry !== snapshot)),
    onError: (error, snapshot) => {
      setUndoStack((stack) => [...stack, snapshot]);
      deckToast.error(commandErrorMessage(error, m.deck.undoFailed));
    },
    onSettled: () => invalidateStudyData(queryClient),
  });

  const cards = (deck.data?.cards ?? []).filter((card) => !pending.has(card.word));
  const current = cards.at(0) ?? null;
  const lastAnswer = undoStack.at(-1) ?? null;

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
