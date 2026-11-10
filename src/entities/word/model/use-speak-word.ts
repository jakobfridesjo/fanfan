import { useQueryClient } from "@tanstack/react-query";
import { useSelector } from "@tanstack/react-store";
import { useEffect, useRef, useState } from "react";
import { commandErrorMessage } from "@/shared/api/commands.ts";
import { speechQuery } from "@/shared/api/queries.ts";
import { speakerAtom } from "@/shared/config/preferences.ts";
import { useMessages } from "@/shared/i18n/messages.ts";
import { toastError } from "@/shared/lib/toast.ts";

/** Plays `word` aloud; a new call cuts off the one still playing. */
export function useSpeakWord(word: string) {
  const m = useMessages();
  const queryClient = useQueryClient();
  const speaker = useSelector(speakerAtom);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => () => stop(audioRef.current), []);

  const speak = async () => {
    setLoading(true);
    try {
      const opus = await queryClient.query(speechQuery(word, speaker));
      stop(audioRef.current);
      const audio = new Audio(
        URL.createObjectURL(new Blob([opus], { type: "audio/ogg; codecs=opus" }))
      );
      audio.addEventListener("ended", () => URL.revokeObjectURL(audio.src), { once: true });
      audioRef.current = audio;
      await audio.play();
    } catch (error) {
      toastError(commandErrorMessage(error, m.word.playFailed(word)));
    }
    setLoading(false);
  };

  return { speak, loading };
}

function stop(audio: HTMLAudioElement | null) {
  if (!audio) return;
  audio.pause();
  URL.revokeObjectURL(audio.src);
}
