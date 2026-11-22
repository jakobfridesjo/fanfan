import type { QueryClient } from "@tanstack/solid-query";
import { commandErrorMessage, commands, type PrepareProgress } from "@/shared/api/commands.ts";
import { ensureModel } from "@/shared/api/model-downloads.ts";
import { bookAudioQuery } from "@/shared/api/queries.ts";
import type { Speaker } from "@/shared/config/preferences.ts";
import { currentMessages } from "@/shared/i18n/messages.ts";
import { createAtom } from "@/shared/lib/atom.ts";
import { toastError, toastSuccess } from "@/shared/lib/toast.ts";
import { fractionDone, type Timing } from "@/features/book-audio/model/progress.ts";

export interface BookAudioRequest {
  documentId: number;
  /** The book's title, for the toast when it is done. */
  title: string;
  speaker: Speaker;
  /** The first and last section, by position. */
  from: number;
  to: number;
}

export interface BookAudioJob extends BookAudioRequest {
  progress: PrepareProgress | null;
  timing: Timing | null;
  /** Unix milliseconds of the latest report. */
  reportedAt: number;
}

/**
 * The book whose audio is being prepared; null when none is. Kept outside the components, so it
 * carries on while the person moves between pages.
 */
export const bookAudioJobAtom = createAtom<BookAudioJob | null>(null);

export function resetBookAudioJob() {
  bookAudioJobAtom.set(null);
}

/** Starts preparing a book's audio, unless another book's is under way. */
export async function startBookAudio(queryClient: QueryClient, request: BookAudioRequest) {
  if (bookAudioJobAtom.get()) return;
  if (!(await ensureModel(queryClient, "voice", { toast: true }))) return;
  const m = currentMessages();
  const refresh = () => queryClient.invalidateQueries({ queryKey: bookAudioQuery().queryKey });
  bookAudioJobAtom.set({ ...request, progress: null, timing: null, reportedAt: Date.now() });
  try {
    const finished = await commands.prepareBookAudio(
      request.documentId,
      request.speaker,
      request.from,
      request.to,
      (progress) => {
        const job = bookAudioJobAtom.get();
        if (!job) return;
        const now = Date.now();
        bookAudioJobAtom.set({
          ...job,
          progress,
          timing: job.timing ?? {
            section: progress.section,
            fraction: fractionDone(progress),
            at: now,
          },
          reportedAt: now,
        });
        if (job.progress && progress.sectionsDone > job.progress.sectionsDone) void refresh();
      }
    );
    if (finished) toastSuccess(m.bookAudio.readyToast(request.title));
  } catch (error) {
    toastError(commandErrorMessage(error, m.bookAudio.failed));
  }
  bookAudioJobAtom.set(null);
  await refresh();
}

/** The job stops before its next phrase; what was saved stays for next time. */
export function cancelBookAudio() {
  return commands.cancelBookAudio();
}
