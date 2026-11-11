import { Volume2 } from "lucide-react";
import { useMessages } from "@/shared/i18n/messages.ts";
import { ModelDownloadFailure, ModelDownloadProgress } from "@/shared/ui/ModelDownloadProgress.tsx";
import { TooltipIconButton } from "@/shared/ui/TooltipIconButton.tsx";
import { Button } from "@/shared/ui/shadcn/button.tsx";
import { Skeleton } from "@/shared/ui/shadcn/skeleton.tsx";
import type { MissingTranslator } from "@/pages/reader/model/use-reader-manager.ts";

export interface PassageTranslationProps {
  /** The dragged-over passage, in the chosen script. */
  text: string;
  translation: string | undefined;
  loading: boolean;
  error: string | null;
  /** Set while the translator is not downloaded, in place of a translation. */
  missingTranslator: MissingTranslator | null;
  /** Reads the passage aloud, following along in the text. */
  onListen: () => void;
}

/** The panel's translation view: a dragged-over passage and its translation. */
export function PassageTranslation({
  text,
  translation,
  loading,
  error,
  missingTranslator,
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
        {missingTranslator ? (
          <TranslatorDownload translator={missingTranslator} />
        ) : loading ? (
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

function TranslatorDownload({ translator }: { translator: MissingTranslator }) {
  const m = useMessages();
  const { download } = translator;

  if (download?.state === "downloading")
    return (
      <div className="flex flex-col gap-3 rounded-lg border p-3">
        <p className="font-medium">{m.models.translatorDownloading}</p>
        <ModelDownloadProgress progress={download} label={m.models.names.translator} />
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">{m.models.translationWhenDone}</p>
          <Button type="button" variant="outline" size="sm" onClick={translator.onCancel}>
            {m.common.cancel}
          </Button>
        </div>
      </div>
    );

  return (
    <div className="flex flex-col items-start gap-3">
      {download?.state === "failed" ? (
        <ModelDownloadFailure download={download} />
      ) : (
        <p className="text-sm text-muted-foreground">{m.models.translatorMissing}</p>
      )}
      <Button type="button" variant="outline" size="sm" onClick={translator.onDownload}>
        {download ? m.common.tryAgain : m.models.download}
      </Button>
    </div>
  );
}
