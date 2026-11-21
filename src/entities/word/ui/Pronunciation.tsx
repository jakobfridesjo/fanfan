import { Show } from "solid-js";
import type { Reading } from "@/shared/api/commands.ts";
import { shownNotationsAtom } from "@/shared/config/preferences.ts";

/** The reading in pinyin and zhuyin, each as the settings show it; zhuyin needs a Chinese font. */
export function ReadingPronunciation(props: { reading: Reading }) {
  const pinyin = () => shownNotationsAtom().includes("pinyin");
  const zhuyin = () => shownNotationsAtom().includes("zhuyin");
  return (
    <Show when={pinyin() || zhuyin()}>
      <span class="inline-flex flex-wrap items-baseline gap-x-[0.25em]">
        <Show when={pinyin()}>
          <span>{props.reading.pinyin}</span>
        </Show>
        <Show when={pinyin() && zhuyin()}>
          <span aria-hidden="true" class="font-light text-muted-foreground">
            /
          </span>
        </Show>
        <Show when={zhuyin()}>
          <span lang="zh">{props.reading.zhuyin}</span>
        </Show>
      </span>
    </Show>
  );
}
