import { Headphones } from "lucide";
import { Match, Switch } from "solid-js";
import { useMessages } from "@/shared/i18n/messages.ts";
import { cn } from "@/shared/lib/class-names.ts";
import { formatPercent } from "@/shared/lib/number-format.ts";
import { Icon } from "@/shared/ui/Icon.tsx";
import { Badge } from "@/shared/ui/shadcn/badge.tsx";
import { Button } from "@/shared/ui/shadcn/button.tsx";
import { Progress } from "@/shared/ui/shadcn/progress.tsx";
import type { BookAudioJob } from "@/features/book-audio/model/book-audio-job.ts";
import { fractionDone, timeLeft } from "@/features/book-audio/model/progress.ts";
import { useBookAudio } from "@/features/book-audio/model/use-book-audio.ts";

const STRIP =
  "absolute inset-x-1.5 bottom-3 flex flex-col gap-1.5 rounded-lg bg-popover/95 p-2 shadow-sm";

/**
 * Laid over a book's cover: progress while its audio is prepared, and a badge once it is ready.
 * The cover's box must be `relative`.
 */
export function BookAudioStatus(props: { documentId: number; class?: string }) {
  const m = useMessages();
  const audio = useBookAudio(() => props.documentId);

  return (
    <Switch>
      <Match when={audio.state?.kind === "preparing" && audio.state.job}>
        {(job) => <PreparingStrip job={job()} class={props.class} onCancel={audio.cancel} />}
      </Match>
      <Match when={audio.state?.kind === "ready"}>
        <Badge variant="secondary" class={cn("absolute top-2 right-2 shadow-sm", props.class)}>
          <Icon icon={Headphones} data-icon="inline-start" />
          {m.bookAudio.ready}
        </Badge>
      </Match>
    </Switch>
  );
}

function PreparingStrip(props: { job: BookAudioJob; class?: string; onCancel: () => void }) {
  const m = useMessages();
  const label = () => (props.job.progress?.waiting ? m.bookAudio.waiting : m.bookAudio.preparing);
  const done = () => (props.job.progress ? fractionDone(props.job.progress) : 0);
  const detail = () => {
    const progress = props.job.progress;
    if (!progress) return "";
    const chapter = m.bookAudio.chapterOf(
      Math.min(progress.sectionsDone + 1, progress.sectionsTotal),
      progress.sectionsTotal
    );
    const left = timeLeft(props.job.progress, props.job.timing, props.job.reportedAt);
    if (left === null) return chapter;
    const minutes = Math.max(1, Math.round(left / 60_000));
    return `${chapter} · ${m.bookAudio.timeLeft(m.bookAudio.duration(Math.floor(minutes / 60), minutes % 60))}`;
  };

  return (
    <div class={cn(STRIP, props.class)}>
      <div class="flex items-center justify-between gap-1.5 text-xs font-medium">
        <span class="truncate">{label()}</span>
        <span class="tabular-nums">{formatPercent(done(), 1)}</span>
      </div>
      <Progress aria-label={label()} value={done() * 100} />
      <div class="flex items-center justify-between gap-1.5">
        <span class="truncate text-xs text-muted-foreground">{detail()}</span>
        <Button variant="outline" size="xs" onClick={() => props.onCancel()}>
          {m.common.cancel}
        </Button>
      </div>
    </div>
  );
}
