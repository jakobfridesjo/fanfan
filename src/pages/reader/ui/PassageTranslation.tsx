import { Volume2 } from "lucide";
import { Match, Show, Switch } from "solid-js";
import { useMessages } from "@/shared/i18n/messages.ts";
import { Icon } from "@/shared/ui/Icon.tsx";
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
export function PassageTranslation(props: PassageTranslationProps) {
  const m = useMessages();
  return (
    <>
      <div class="flex items-start gap-2">
        <p lang="zh" class="flex-1 text-lg leading-relaxed">
          {props.text}
        </p>
        <TooltipIconButton
          label={m.reader.listenToSelection}
          variant="outline"
          size="icon"
          class="rounded-full"
          onClick={() => props.onListen()}
        >
          <Icon icon={Volume2} />
        </TooltipIconButton>
      </div>
      <section aria-label={m.reader.translation} class="flex flex-col gap-2">
        <h3 class="text-sm text-muted-foreground">{m.reader.translation}</h3>
        <Switch fallback={<p lang="en">{props.translation}</p>}>
          <Match when={props.missingTranslator}>
            {(translator) => <TranslatorDownload translator={translator()} />}
          </Match>
          <Match when={props.loading}>
            <Skeleton class="h-12 w-full motion-reduce:animate-none" />
          </Match>
          <Match when={props.error}>
            <p class="text-sm text-muted-foreground">{props.error}</p>
          </Match>
        </Switch>
      </section>
    </>
  );
}

function TranslatorDownload(props: { translator: MissingTranslator }) {
  const m = useMessages();
  const download = () => props.translator.download;
  const downloading = () => {
    const current = download();
    return current?.state === "downloading" ? current : null;
  };
  const failed = () => {
    const current = download();
    return current?.state === "failed" ? current : null;
  };

  return (
    <Show
      when={downloading()}
      fallback={
        <div class="flex flex-col items-start gap-3">
          <Show
            when={failed()}
            fallback={<p class="text-sm text-muted-foreground">{m.models.translatorMissing}</p>}
          >
            {(stopped) => <ModelDownloadFailure download={stopped()} />}
          </Show>
          <Button variant="outline" size="sm" onClick={() => props.translator.onDownload()}>
            {download() ? m.common.tryAgain : m.models.download}
          </Button>
        </div>
      }
    >
      {(progress) => (
        <div class="flex flex-col gap-3 rounded-lg border p-3">
          <p class="font-medium">{m.models.translatorDownloading}</p>
          <ModelDownloadProgress progress={progress()} label={m.models.names.translator} />
          <div class="flex items-center justify-between gap-3">
            <p class="text-sm text-muted-foreground">{m.models.translationWhenDone}</p>
            <Button variant="outline" size="sm" onClick={() => props.translator.onCancel()}>
              {m.common.cancel}
            </Button>
          </div>
        </div>
      )}
    </Show>
  );
}
