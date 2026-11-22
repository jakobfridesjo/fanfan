import type { PreparedAudio } from "@/shared/api/commands.ts";
import { bookAudioQuery, useCommandQuery } from "@/shared/api/queries.ts";
import {
  bookAudioJobAtom,
  cancelBookAudio,
  type BookAudioJob,
} from "@/features/book-audio/model/book-audio-job.ts";

export type BookAudioState = { kind: "preparing"; job: BookAudioJob } | { kind: "ready" };

/** The sections of `audio` that are prepared, among those asked for. */
export function preparedCount(audio: PreparedAudio) {
  return audio.sections.filter((section) => section >= audio.from && section <= audio.to).length;
}

/**
 * A book's audio: being prepared, or ready in some voice. Audio stopped part
 * way shows nothing here; what was saved still plays, and Settings lists it.
 */
export function useBookAudio(documentId: () => number) {
  const prepared = useCommandQuery(() => bookAudioQuery());

  const state = (): BookAudioState | null => {
    const job = bookAudioJobAtom();
    if (job?.documentId === documentId()) return { kind: "preparing", job };
    const ready = (prepared.data ?? []).filter(
      (audio) =>
        audio.documentId === documentId() && preparedCount(audio) >= audio.to - audio.from + 1
    );
    return ready.length > 0 ? { kind: "ready" } : null;
  };

  return {
    get state() {
      return state();
    },
    cancel: () => void cancelBookAudio(),
  };
}
