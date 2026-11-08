import { noop, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { commandErrorMessage, type SpokenPhrase } from "@/shared/api/commands.ts";
import { speechQuery } from "@/shared/api/queries.ts";
import { useMessages } from "@/shared/i18n/messages.ts";
import { toastError } from "@/shared/lib/toast.ts";

export type ReadAloudStatus = "stopped" | "playing" | "paused";

/**
 * Speaks `phrases` one after another. The next phrase is synthesized while
 * the current one plays, so the voice rarely waits on Rust.
 */
export function useReadAloud(phrases: SpokenPhrase[]) {
  const m = useMessages();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ReadAloudStatus>("stopped");
  const [current, setCurrent] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pausedRef = useRef(false);
  /** Bumped by every play and stop, so an older run notices it was replaced. */
  const runRef = useRef(0);

  useEffect(
    () => () => {
      runRef.current += 1;
      release(audioRef.current);
    },
    []
  );

  const stop = () => {
    runRef.current += 1;
    release(audioRef.current);
    audioRef.current = null;
    pausedRef.current = false;
    setStatus("stopped");
    setCurrent(null);
    setLoading(false);
  };

  const play = async (from: number) => {
    stop();
    const run = runRef.current;
    const replaced = () => run !== runRef.current;
    setStatus("playing");
    for (let index = from; index < phrases.length; index += 1) {
      const phrase = phrases[index];
      if (!phrase) break;
      setCurrent(index);
      setLoading(true);
      try {
        const opus = await queryClient.query(speechQuery(phrase.text));
        if (replaced()) return;
        setLoading(false);
        const next = phrases[index + 1];
        if (next) void queryClient.query(speechQuery(next.text)).catch(noop);
        const audio = new Audio(
          URL.createObjectURL(new Blob([opus], { type: "audio/ogg; codecs=opus" }))
        );
        audioRef.current = audio;
        const played = await playToEnd(audio, !pausedRef.current);
        if (replaced()) return;
        if (!played) throw new Error(m.reader.readAloudFailed);
        release(audio);
        audioRef.current = null;
      } catch (error) {
        if (replaced()) return;
        toastError(commandErrorMessage(error, m.reader.readAloudFailed));
        break;
      }
    }
    stop();
  };

  const pause = () => {
    pausedRef.current = true;
    audioRef.current?.pause();
    setStatus("paused");
  };

  const resume = () => {
    pausedRef.current = false;
    // Still synthesizing: the run starts the audio once it is ready.
    void audioRef.current?.play().catch(noop);
    setStatus("playing");
  };

  return {
    status,
    /** The phrase being spoken, or synthesized to be spoken next. */
    phrase: current === null ? null : (phrases[current] ?? null),
    loading,
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
