import { useSelector } from "@tanstack/react-store";
import type { Reading } from "@/shared/api/commands.ts";
import { shownNotationsAtom } from "@/shared/config/preferences.ts";

/** The reading in pinyin and zhuyin, each as the settings show it; zhuyin needs a Chinese font. */
export function ReadingPronunciation({ reading }: { reading: Reading }) {
  const notations = useSelector(shownNotationsAtom);
  const pinyin = notations.includes("pinyin");
  const zhuyin = notations.includes("zhuyin");
  if (!pinyin && !zhuyin) return null;
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-[0.25em]">
      {pinyin && <span>{reading.pinyin}</span>}
      {pinyin && zhuyin && (
        <span aria-hidden className="font-light text-muted-foreground">
          /
        </span>
      )}
      {zhuyin && <span lang="zh">{reading.zhuyin}</span>}
    </span>
  );
}
