import { useQueryClient } from "@tanstack/solid-query";
import { createSignal, onCleanup } from "solid-js";
import { commandErrorMessage } from "@/shared/api/commands.ts";
import { ensureModel } from "@/shared/api/model-downloads.ts";
import { speechQuery } from "@/shared/api/queries.ts";
import { speakerAtom } from "@/shared/config/preferences.ts";
import { useMessages } from "@/shared/i18n/messages.ts";
import { toastError } from "@/shared/lib/toast.ts";

/** Plays `word` aloud; a new call cuts off the one still playing. */
export function useSpeakWord(word: () => string) {
  const m = useMessages();
  const queryClient = useQueryClient();
  let playing: HTMLAudioElement | null = null;
  const [loading, setLoading] = createSignal(false);

  onCleanup(() => stop(playing));

  const speak = async () => {
    const spoken = word();
    if (!(await ensureModel(queryClient, "voice", { toast: true }))) return;
    setLoading(true);
    try {
      const opus = await queryClient.query(speechQuery(spoken, speakerAtom.get()));
      stop(playing);
      const audio = new Audio(
        URL.createObjectURL(new Blob([opus], { type: "audio/ogg; codecs=opus" }))
      );
      audio.addEventListener("ended", () => URL.revokeObjectURL(audio.src), { once: true });
      playing = audio;
      await audio.play();
    } catch (error) {
      toastError(commandErrorMessage(error, m.word.playFailed(spoken)));
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
