import { useQueryClient } from "@tanstack/solid-query";
import { createMemo, createSignal, untrack } from "solid-js";
import {
  bookAudioQuery,
  sectionLengthsQuery,
  sectionsQuery,
  useCommandQuery,
} from "@/shared/api/queries.ts";
import { scriptAtom, speakerAtom, type Speaker } from "@/shared/config/preferences.ts";
import { bookAudioJobAtom, startBookAudio } from "@/features/book-audio/model/book-audio-job.ts";

/** How fast the voices read a book, punctuation included, as measured on a sample passage. */
const CHARACTERS_PER_SECOND = 3.3;
/** Opus at 32 kbps, `OPUS_BITRATE` in `speech.rs`. */
const BYTES_PER_SECOND = 4000;

/** The prepare audio dialog: a voice and a range of sections, by default the whole book. */
export function usePrepareAudio(documentId: () => number, title: () => string) {
  const queryClient = useQueryClient();
  const titles = useCommandQuery(() => sectionsQuery(documentId(), scriptAtom()));
  const lengths = useCommandQuery(() => sectionLengthsQuery(documentId()));
  const prepared = useCommandQuery(() => bookAudioQuery());
  const [speaker, setSpeaker] = createSignal<Speaker>(untrack(() => speakerAtom.get()));
  const [from, setFrom] = createSignal(0);
  const [chosenTo, setChosenTo] = createSignal<number | null>(null);

  const count = () => titles.data?.length ?? 0;
  const to = () => chosenTo() ?? Math.max(count() - 1, 0);
  const alreadyPrepared = createMemo(() => {
    const audio = prepared.data?.find(
      (entry) => entry.documentId === documentId() && entry.speaker === speaker()
    );
    return new Set(audio?.sections ?? []);
  });
  const remaining = createMemo(() => {
    const sections: number[] = [];
    for (let position = from(); position <= to(); position += 1)
      if (!alreadyPrepared().has(position)) sections.push(position);
    return sections;
  });
  const seconds = () => {
    const all = lengths.data ?? [];
    const characters = remaining().reduce((sum, position) => sum + (all[position] ?? 0), 0);
    return characters / CHARACTERS_PER_SECOND;
  };

  return {
    get titles() {
      return titles.data ?? [];
    },
    get loading() {
      return titles.data === undefined || lengths.data === undefined;
    },
    get speaker() {
      return speaker();
    },
    setSpeaker,
    get from() {
      return from();
    },
    /** Moves `to` along when it would come before the new `from`. */
    setFrom: (position: number) => {
      setFrom(position);
      if (to() < position) setChosenTo(position);
    },
    get to() {
      return to();
    },
    setTo: (position: number) => void setChosenTo(position),
    get count() {
      return to() - from() + 1;
    },
    get wholeBook() {
      return from() === 0 && to() === count() - 1;
    },
    get skipped() {
      return to() - from() + 1 - remaining().length;
    },
    get nothingNew() {
      return remaining().length === 0;
    },
    get seconds() {
      return seconds();
    },
    get bytes() {
      return seconds() * BYTES_PER_SECOND;
    },
    get busy() {
      return bookAudioJobAtom() !== null;
    },
    start: () =>
      void startBookAudio(queryClient, {
        documentId: documentId(),
        title: title(),
        speaker: speaker(),
        from: from(),
        to: to(),
      }),
  };
}
