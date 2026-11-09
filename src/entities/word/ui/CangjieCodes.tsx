import { useSelector } from "@tanstack/react-store";
import type { StudyCard } from "@/shared/api/commands.ts";
import { shownNotationsAtom } from "@/shared/config/preferences.ts";
import { useMessages } from "@/shared/i18n/messages.ts";
import { cn } from "@/shared/lib/class-names.ts";

/** The radical each Cangjie key types. */
const RADICALS: Record<string, string> = {
  A: "日",
  B: "月",
  C: "金",
  D: "木",
  E: "水",
  F: "火",
  G: "土",
  H: "竹",
  I: "戈",
  J: "十",
  K: "大",
  L: "中",
  M: "一",
  N: "弓",
  O: "人",
  P: "心",
  Q: "手",
  R: "口",
  S: "尸",
  T: "廿",
  U: "山",
  V: "女",
  W: "田",
  X: "難",
  Y: "卜",
  Z: "重",
};

type CangjieCard = Pick<
  StudyCard,
  "displayWord" | "alternateWord" | "cangjie" | "alternateCangjie"
>;

/** Each shown form's Cangjie codes, as radicals and keys, when the settings show them. */
export function CangjieCodes({ card, className }: { card: CangjieCard; className?: string }) {
  const m = useMessages();
  const shown = useSelector(shownNotationsAtom).includes("cangjie");
  const forms = [
    { word: card.displayWord, codes: card.cangjie },
    { word: card.alternateWord, codes: card.alternateCangjie },
  ].flatMap(({ word, codes }) => (word && codes ? [{ word, codes }] : []));
  if (!shown || forms.length === 0) return null;
  return (
    <dl
      role="group"
      aria-label={m.word.cangjie}
      className={cn("flex flex-col gap-0.5 text-sm text-muted-foreground", className)}
    >
      {forms.map(({ word, codes }) => (
        <div key={word} className="flex flex-wrap items-baseline gap-x-2">
          <dt lang="zh" className={forms.length === 1 ? "sr-only" : undefined}>
            {word}
          </dt>
          <dd lang="zh">
            {codes
              .split(" ")
              .map((code) =>
                code
                  .split("")
                  .map((key) => RADICALS[key] ?? key)
                  .join("")
              )
              .join(" ")}
          </dd>
          <dd className="font-mono text-xs">{codes}</dd>
        </div>
      ))}
    </dl>
  );
}
