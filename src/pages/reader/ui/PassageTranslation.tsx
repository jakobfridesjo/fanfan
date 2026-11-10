import { Volume2 } from "lucide-react";
import { useMessages } from "@/shared/i18n/messages.ts";
import { TooltipIconButton } from "@/shared/ui/TooltipIconButton.tsx";
import { Skeleton } from "@/shared/ui/shadcn/skeleton.tsx";

export interface PassageTranslationProps {
  /** The dragged-over passage, in the chosen script. */
  text: string;
  translation: string | undefined;
  loading: boolean;
  error: string | null;
  /** Reads the passage aloud, following along in the text. */
  onListen: () => void;
}

/** The panel's translation view: a dragged-over passage and its translation. */
export function PassageTranslation({
  text,
  translation,
  loading,
  error,
  onListen,
}: PassageTranslationProps) {
  const m = useMessages();
  return (
    <>
      <div className="flex items-start gap-2">
        <p lang="zh" className="flex-1 text-lg leading-relaxed">
          {text}
        </p>
        <TooltipIconButton
          label={m.reader.listenToSelection}
          variant="outline"
          size="icon"
          className="rounded-full"
          onClick={onListen}
        >
          <Volume2 />
        </TooltipIconButton>
      </div>
      <section aria-label={m.reader.translation} className="flex flex-col gap-2">
        <h3 className="text-sm text-muted-foreground">{m.reader.translation}</h3>
        {loading ? (
          <Skeleton className="h-12 w-full motion-reduce:animate-none" />
        ) : error ? (
          <p className="text-sm text-muted-foreground">{error}</p>
        ) : (
          <p lang="en">{translation}</p>
        )}
      </section>
    </>
  );
}
