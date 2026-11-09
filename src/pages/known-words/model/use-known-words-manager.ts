import { useMemo } from "react";
import { useIsMutating, useMutation, useQuery } from "@tanstack/react-query";
import { useSelector } from "@tanstack/react-store";
import {
  commandErrorMessage,
  commands,
  type WordEntry,
  type WordStatus,
} from "@/shared/api/commands.ts";
import { wordListQuery } from "@/shared/api/queries.ts";
import { scriptAtom } from "@/shared/config/preferences.ts";
import { useMessages } from "@/shared/i18n/messages.ts";
import { actionToasts } from "@/shared/lib/toast.ts";
import { useQueryErrorToast } from "@/shared/lib/use-query-error-toast.ts";
import { useTableViewState } from "@/shared/lib/use-table-view-state.ts";

const knownWordsToast = actionToasts("known-words-action");

const NO_WORDS: WordEntry[] = [];

interface StatusChange {
  entry: WordEntry;
  status: WordStatus;
}

const STATUS_MUTATION_KEY = ["known-words", "set-status"];

export function useKnownWordsManager() {
  const m = useMessages();
  const script = useSelector(scriptAtom);
  const words = useQuery(wordListQuery(script));
  useQueryErrorToast(words.error ? m.knownWords.loadFailed : null, "word-list-query");
  const viewState = useTableViewState("known-words");

  /** Marks every word in a word-list file (Pleco or Anki export, plain list) as known. */
  const importMutation = useMutation({
    mutationFn: async (file: File) => commands.importKnownWords(await file.text()),
    meta: { changesStudyData: true },
    onSuccess: ({ found, added }, file) => {
      if (found === 0) knownWordsToast.info(m.knownWords.noWordsInFile(file.name));
      else knownWordsToast.success(m.knownWords.marked(added, found - added));
    },
    onError: (error) =>
      knownWordsToast.error(commandErrorMessage(error, m.knownWords.importFailed)),
  });

  const undoMutation = useMutation({
    mutationFn: commands.restoreWord,
    meta: { changesStudyData: true },
    onError: (error) => knownWordsToast.error(commandErrorMessage(error, m.knownWords.undoFailed)),
  });

  const statusMutation = useMutation({
    mutationKey: STATUS_MUTATION_KEY,
    mutationFn: ({ entry, status }: StatusChange) => commands.setWordStatus(entry.word, status),
    meta: { changesStudyData: true },
    onSuccess: (snapshot, { entry, status }) => {
      const message =
        status === "known"
          ? m.knownWords.nowKnown(entry.displayWord)
          : m.knownWords.nowLearning(entry.displayWord);
      knownWordsToast.success(message, {
        action: { label: m.knownWords.undo, onClick: () => undoMutation.mutate(snapshot) },
      });
    },
    onError: (error) =>
      knownWordsToast.error(commandErrorMessage(error, m.knownWords.statusFailed)),
  });

  const list = words.data ?? NO_WORDS;
  const counts = useMemo(
    () => ({
      known: list.filter((entry) => entry.status === "known").length,
      learning: list.filter((entry) => entry.status === "learning").length,
    }),
    [list]
  );

  return {
    words: list,
    counts,
    isLoading: words.isPending,
    loadFailed: words.isError,
    retry: () => void words.refetch(),
    viewState,
    importFile: (file: File) => importMutation.mutate(file),
    importing: importMutation.isPending,
    setStatus: statusMutation.mutate,
  };
}

/** Whether `word`'s status is being changed. Only that word's row re-renders when it starts or ends. */
export function useIsChangingStatus(word: string) {
  const pending = useIsMutating({
    mutationKey: STATUS_MUTATION_KEY,
    predicate: (mutation) =>
      (mutation.state.variables as StatusChange | undefined)?.entry.word === word,
  });
  return pending > 0;
}
