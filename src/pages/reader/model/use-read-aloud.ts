import { noop, useQueryClient } from "@tanstack/solid-query";
import { createSignal, onCleanup } from "solid-js";
import { commandErrorMessage, type SpokenPhrase } from "@/shared/api/commands.ts";
import { ensureModel } from "@/shared/api/model-downloads.ts";
import { speechQuery } from "@/shared/api/queries.ts";
import { speakerAtom } from "@/shared/config/preferences.ts";
import { useMessages } from "@/shared/i18n/messages.ts";
import { createAtom } from "@/shared/lib/atom.ts";
import { toastError } from "@/shared/lib/toast.ts";

export type ReadAloudStatus = "stopped" | "playing" | "paused";

/** Phrases to speak in turn, and what to read once they run out. */
export interface Reading {
  phrases: SpokenPhrase[];
  /** Called as the voice reaches these phrases, such as to show their chapter. */
  begin?: () => void;
  /** Where reading carries on after the last phrase; null, or none, ends it. */
  next?: () => Promise<Reading | null>;
}

type Outcome = "finished" | "failed" | "replaced";

/**
 * Speaks a reading's phrases one after another, then carries on with the next reading. The next
 * phrase is synthesized while the current one plays, so the voice rarely waits on Rust.
 */
export function useReadAloud() {
  const m = useMessages();
  const queryClient = useQueryClient();
  // Read back by the handlers that set them, so atoms rather than signals.
  const status = createAtom<ReadAloudStatus>("stopped");
  const spoken = createAtom<SpokenPhrase | null>(null);
  const [loading, setLoading] = createSignal(false);
  let playing: HTMLAudioElement | null = null;
  let paused = false;
  /** Bumped by every play and stop, so an older run notices it was replaced. */
  let run = 0;

  onCleanup(() => {
    run += 1;
    release(playing);
  });

  const stop = () => {
    run += 1;
    release(playing);
    playing = null;
    paused = false;
    status.set("stopped");
    spoken.set(null);
    setLoading(false);
  };

  const speak = async (
    list: SpokenPhrase[],
    from: number,
    replaced: () => boolean
  ): Promise<Outcome> => {
    const speaker = speakerAtom.get();
    for (let index = from; index < list.length; index += 1) {
      const phrase = list[index];
      if (!phrase) break;
      spoken.set(phrase);
      setLoading(true);
      try {
        const opus = await queryClient.query(speechQuery(phrase.text, speaker));
        if (replaced()) return "replaced";
        setLoading(false);
        const next = list[index + 1];
        if (next) void queryClient.query(speechQuery(next.text, speaker)).catch(noop);
        const audio = new Audio(
          URL.createObjectURL(new Blob([opus], { type: "audio/ogg; codecs=opus" }))
        );
        playing = audio;
        const played = await playToEnd(audio, !paused);
        if (replaced()) return "replaced";
        if (!played) {
          toastError(m.reader.readAloudFailed);
          return "failed";
        }
        release(audio);
        playing = null;
      } catch (error) {
        if (replaced()) return "replaced";
        toastError(commandErrorMessage(error, m.reader.readAloudFailed));
        return "failed";
      }
    }
    return "finished";
  };

  const play = async (from: number, first: Reading) => {
    if (!(await ensureModel(queryClient, "voice", { toast: true }))) return;
    stop();
    const started = run;
    const replaced = () => started !== run;
    status.set("playing");
    let reading: Reading | null = first;
    let start = from;
    while (reading) {
      reading.begin?.();
      const outcome = await speak(reading.phrases, start, replaced);
      if (outcome === "replaced") return;
      if (outcome === "failed" || !reading.next) break;
      spoken.set(null);
      setLoading(true);
      try {
        reading = await reading.next();
      } catch (error) {
        if (replaced()) return;
        toastError(commandErrorMessage(error, m.reader.readAloudFailed));
        break;
      }
      if (replaced()) return;
      start = 0;
    }
    stop();
  };

  const pause = () => {
    paused = true;
    playing?.pause();
    status.set("paused");
  };

  const resume = () => {
    paused = false;
    // Still synthesizing: the run starts the audio once it is ready.
    void playing?.play().catch(noop);
    status.set("playing");
  };

  return {
    get status() {
      status();
      return status.get();
    },
    /** The phrase being spoken, or synthesized to be spoken next. */
    get phrase() {
      spoken();
      return spoken.get();
    },
    get loading() {
      return loading();
    },
    play,
    pause,
    resume,
    stop,
  };
}

/** Whether `audio` played to its end, however often it was paused on the way. */
function playToEnd(audio: HTMLAudioElement, start: boolean) {
  return new Promise<boolean>((resolve) => {
    audio.addEventListener("ended", () => resolve(true), { once: true });
    audio.addEventListener("error", () => resolve(false), { once: true });
    if (start) audio.play().catch((error: unknown) => interrupted(error) || resolve(false));
  });
}

/** `play()` rejects this way when a pause cuts it off, which is no failure. */
function interrupted(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function release(audio: HTMLAudioElement | null) {
  if (!audio) return;
  audio.pause();
  URL.revokeObjectURL(audio.src);
}
