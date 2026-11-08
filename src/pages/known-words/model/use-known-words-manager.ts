import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSelector } from "@tanstack/react-store";
import { commandErrorMessage, commands } from "@/shared/api/commands.ts";
import { invalidateStudyData, wordCountsQuery } from "@/shared/api/queries.ts";
import { useAppForm } from "@/shared/lib/form.ts";
import { useMessages } from "@/shared/i18n/messages.ts";
import { actionToasts } from "@/shared/lib/toast.ts";
import { useQueryErrorToast } from "@/shared/lib/use-query-error-toast.ts";
import {
  EMPTY_KNOWN_WORDS_FORM,
  knownWordsFormOptions,
} from "@/pages/known-words/model/known-words-form.ts";

const knownWordsToast = actionToasts("known-words-action");

export function useKnownWordsManager() {
  const m = useMessages();
  const queryClient = useQueryClient();
  const counts = useQuery(wordCountsQuery());
  useQueryErrorToast(counts.error ? m.knownWords.countsFailed : null, "word-counts-query");

  const importMutation = useMutation({
    mutationFn: commands.importKnownWords,
    onSuccess: async ({ found, added }) => {
      form.reset(EMPTY_KNOWN_WORDS_FORM);
      await invalidateStudyData(queryClient);
      knownWordsToast.success(m.knownWords.marked(added, found - added));
    },
    onError: (error) =>
      knownWordsToast.error(commandErrorMessage(error, m.knownWords.importFailed)),
  });

  const form = useAppForm({
    ...knownWordsFormOptions,
    onSubmit: ({ validatorOutputs }) => importMutation.mutateAsync(validatorOutputs[0].text),
  });
  const canSubmit = useSelector(form.atom, (state) => state.canSubmit);

  /** Fills the text box from a word-list file (Pleco or Anki export, plain list). */
  const loadFile = async (file: File) => {
    form.setFieldValue("text", await file.text());
  };

  return {
    counts: counts.data,
    form,
    canSubmit,
    pending: importMutation.isPending,
    loadFile,
  };
}
