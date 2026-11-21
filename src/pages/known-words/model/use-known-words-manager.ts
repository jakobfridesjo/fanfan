import { createMemo } from "solid-js";
import { useIsMutating, useMutation } from "@tanstack/solid-query";
import {
  commandErrorMessage,
  commands,
  type WordEntry,
  type WordStatus,
} from "@/shared/api/commands.ts";
import { useCommandQuery, wordListQuery } from "@/shared/api/queries.ts";
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
  const words = useCommandQuery(() => wordListQuery(scriptAtom()));
  useQueryErrorToast(() => (words.isError ? m.knownWords.loadFailed : null), "word-list-query");
  const viewState = useTableViewState("known-words");

  /** Marks every word in a word-list file (Pleco or Anki export, plain list) as known. */
  const importMutation = useMutation(() => ({
    mutationFn: async (file: File) => commands.importKnownWords(await file.text()),
    meta: { changesStudyData: true as const },
    onSuccess: ({ found, added }: { found: number; added: number }, file: File) => {
      if (found === 0) knownWordsToast.info(m.knownWords.noWordsInFile(file.name));
      else knownWordsToast.success(m.knownWords.marked(added, found - added));
    },
    onError: (error: Error) =>
      knownWordsToast.error(commandErrorMessage(error, m.knownWords.importFailed)),
  }));

  const undoMutation = useMutation(() => ({
    mutationFn: commands.restoreWord,
    meta: { changesStudyData: true as const },
    onError: (error: Error) =>
      knownWordsToast.error(commandErrorMessage(error, m.knownWords.undoFailed)),
  }));

  const statusMutation = useMutation(() => ({
    mutationKey: STATUS_MUTATION_KEY,
    mutationFn: ({ entry, status }: StatusChange) => commands.setWordStatus(entry.word, status),
    meta: { changesStudyData: true as const },
    onSuccess: (snapshot, { entry, status }) => {
      const message =
        status === "known"
          ? m.knownWords.nowKnown(entry.displayWord)
          : m.knownWords.nowLearning(entry.displayWord);
      knownWordsToast.success(message, {
        action: { label: m.knownWords.undo, onClick: () => void undoMutation.mutate(snapshot) },
      });
    },
    onError: (error) =>
      knownWordsToast.error(commandErrorMessage(error, m.knownWords.statusFailed)),
  }));

  const list = createMemo(() => words.data ?? NO_WORDS);
  const counts = createMemo(() => ({
    known: list().filter((entry) => entry.status === "known").length,
    learning: list().filter((entry) => entry.status === "learning").length,
  }));

  return {
    get words() {
      return list();
    },
    get counts() {
      return counts();
    },
    get isLoading() {
      return words.data === undefined && !words.isError;
    },
    get loadFailed() {
      return words.isError;
    },
    retry: () => void words.refetch(),
    viewState,
    importFile: (file: File) => importMutation.mutate(file),
    get importing() {
      return importMutation.isPending;
    },
    setStatus: (change: StatusChange) => void statusMutation.mutate(change),
  };
}

/** Whether `word`'s status is being changed. Only that word's row follows it. */
export function useIsChangingStatus(word: () => string) {
  const pending = useIsMutating(() => ({
    mutationKey: STATUS_MUTATION_KEY,
    predicate: (mutation) =>
      (mutation.state.variables as StatusChange | undefined)?.entry.word === word(),
  }));
  return () => pending() > 0;
}
