import { Headphones } from "lucide";
import { createMemo, Show } from "solid-js";
import { SPEAKER_NAMES, SPEAKERS, type Speaker } from "@/shared/config/preferences.ts";
import { useMessages } from "@/shared/i18n/messages.ts";
import { formatMegabytes } from "@/shared/lib/number-format.ts";
import { Icon } from "@/shared/ui/Icon.tsx";
import { Button } from "@/shared/ui/shadcn/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/shadcn/dialog.tsx";
import { Select } from "@/shared/ui/shadcn/select.tsx";
import { usePrepareAudio } from "@/features/book-audio/model/use-prepare-audio.ts";

/** Chooses a voice and the chapters to prepare, showing how long and large the audio will be. */
export function PrepareAudioDialog(props: {
  documentId: number;
  title: string;
  onClose: () => void;
}) {
  const m = useMessages();
  const prepare = usePrepareAudio(
    () => props.documentId,
    () => props.title
  );
  const voices = createMemo(() =>
    SPEAKERS.map((speaker) => ({
      value: speaker,
      label: `${SPEAKER_NAMES[speaker]} · ${m.settings.voices[speaker]}`,
    }))
  );
  const chapters = createMemo(() =>
    prepare.titles.map((title, position) => {
      const label = m.bookAudio.chapterOption(
        position + 1,
        title ?? m.reader.untitledSection(position + 1)
      );
      return { value: `${position}`, label, content: () => <span lang="zh">{label}</span> };
    })
  );
  const duration = () => {
    const minutes = Math.max(1, Math.round(prepare.seconds / 60));
    return m.bookAudio.duration(Math.floor(minutes / 60), minutes % 60);
  };
  const start = () => {
    prepare.start();
    props.onClose();
  };

  return (
    <Dialog open onClose={() => props.onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {m.bookAudio.title} · <span lang="zh">{props.title}</span>
          </DialogTitle>
          <DialogDescription>{m.bookAudio.description}</DialogDescription>
        </DialogHeader>

        <div class="flex flex-col gap-2">
          <span class="text-sm font-medium">{m.bookAudio.voice}</span>
          <Select
            aria-label={m.bookAudio.voice}
            class="w-full"
            options={voices()}
            value={prepare.speaker}
            onChange={(value) => {
              if (value !== null) prepare.setSpeaker(value as Speaker);
            }}
          />
        </div>

        <div class="flex flex-col gap-2">
          <div class="grid grid-cols-2 gap-3">
            <div class="flex min-w-0 flex-col gap-2">
              <span class="text-sm font-medium">{m.bookAudio.from}</span>
              <Select
                aria-label={m.bookAudio.from}
                class="w-full"
                options={chapters()}
                value={prepare.loading ? null : `${prepare.from}`}
                onChange={(value) => {
                  if (value !== null) prepare.setFrom(Number(value));
                }}
              />
            </div>
            <div class="flex min-w-0 flex-col gap-2">
              <span class="text-sm font-medium">{m.bookAudio.to}</span>
              <Select
                aria-label={m.bookAudio.to}
                class="w-full"
                options={chapters().slice(prepare.from)}
                value={prepare.loading ? null : `${prepare.to}`}
                onChange={(value) => {
                  if (value !== null) prepare.setTo(Number(value));
                }}
              />
            </div>
          </div>
          <Show when={!prepare.loading}>
            <p class="text-sm text-muted-foreground">
              {m.bookAudio.range(prepare.count, prepare.wholeBook)}
              <Show when={prepare.skipped > 0}> · {m.bookAudio.skipped(prepare.skipped)}</Show>
            </p>
          </Show>
        </div>

        <dl class="grid grid-cols-3 gap-3 rounded-lg border p-3">
          <div class="flex flex-col gap-0.5">
            <dt class="text-xs text-muted-foreground">{m.bookAudio.audio}</dt>
            <dd class="font-medium tabular-nums">
              {prepare.nothingNew ? m.bookAudio.nothingNew : m.bookAudio.about(duration())}
            </dd>
          </div>
          <div class="flex flex-col gap-0.5">
            <dt class="text-xs text-muted-foreground">{m.bookAudio.diskSpace}</dt>
            <dd class="font-medium tabular-nums">
              {m.bookAudio.about(formatMegabytes(prepare.nothingNew ? 0 : prepare.bytes))}
            </dd>
          </div>
          <div class="flex flex-col gap-0.5">
            <dt class="text-xs text-muted-foreground">{m.bookAudio.time}</dt>
            <dd class="text-xs">{m.bookAudio.timeAfterFirst}</dd>
          </div>
        </dl>

        <Show when={prepare.busy}>
          <p role="status" class="text-sm text-muted-foreground">
            {m.bookAudio.busy}
          </p>
        </Show>

        <DialogFooter class="grid grid-cols-2 sm:flex">
          <Button variant="outline" onClick={() => props.onClose()}>
            {m.common.cancel}
          </Button>
          <Button disabled={prepare.loading || prepare.busy || prepare.nothingNew} onClick={start}>
            <Icon icon={Headphones} data-icon="inline-start" />
            {m.bookAudio.start}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
