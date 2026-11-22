import { useMutation, useQueryClient } from "@tanstack/solid-query";
import { createMemo, createSignal } from "solid-js";
import { commandErrorMessage, commands, type PreparedAudio } from "@/shared/api/commands.ts";
import { bookAudioQuery, documentsQuery, useCommandQuery } from "@/shared/api/queries.ts";
import { useMessages } from "@/shared/i18n/messages.ts";
import { actionToasts } from "@/shared/lib/toast.ts";
import { bookAudioJobAtom } from "@/features/book-audio/model/book-audio-job.ts";
import { preparedCount } from "@/features/book-audio/model/use-book-audio.ts";

const deleteToast = actionToasts("book-audio");

export interface BookAudioRow {
  audio: PreparedAudio;
  title: string;
  /** Prepared sections among those asked for. */
  done: number;
  total: number;
  preparing: boolean;
}

/** Each book's prepared audio and its size, and deleting it. */
export function useBookAudioStorage() {
  const m = useMessages();
  const queryClient = useQueryClient();
  const prepared = useCommandQuery(() => bookAudioQuery());
  const documents = useCommandQuery(() => documentsQuery());
  /** The audio whose deletion waits for confirmation, or `all`. */
  const [deleting, setDeleting] = createSignal<PreparedAudio | "all" | null>(null);

  const rows = createMemo((): BookAudioRow[] => {
    const job = bookAudioJobAtom();
    return (prepared.data ?? []).map((audio) => ({
      audio,
      title: documents.data?.find((document) => document.id === audio.documentId)?.title ?? "",
      done: preparedCount(audio),
      total: audio.to - audio.from + 1,
      preparing: job?.documentId === audio.documentId && job.speaker === audio.speaker,
    }));
  });

  const deleteMutation = useMutation(() => ({
    mutationFn: async (audios: PreparedAudio[]) => {
      for (const audio of audios) await commands.deleteBookAudio(audio.documentId, audio.speaker);
    },
    onError: (error: Error) =>
      deleteToast.error(commandErrorMessage(error, m.bookAudio.deleteFailed)),
    onSettled: async () => {
      setDeleting(null);
      await queryClient.invalidateQueries({ queryKey: bookAudioQuery().queryKey });
    },
  }));

  return {
    get rows() {
      return rows();
    },
    get bytes() {
      return rows().reduce((sum, row) => sum + row.audio.bytes, 0);
    },
    get deleting() {
      return deleting();
    },
    askToDelete: (audio: PreparedAudio | "all") => void setDeleting(audio),
    closeDelete: () => void setDeleting(null),
    confirmDelete: () => {
      const chosen = deleting();
      if (chosen === null) return;
      void deleteMutation.mutate(chosen === "all" ? rows().map((row) => row.audio) : [chosen]);
    },
    get deletePending() {
      return deleteMutation.isPending;
    },
  };
}
