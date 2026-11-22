import { Headphones, Trash2 } from "lucide";
import { For, Show } from "solid-js";
import { SPEAKER_NAMES } from "@/shared/config/preferences.ts";
import { useMessages } from "@/shared/i18n/messages.ts";
import { formatMegabytes } from "@/shared/lib/number-format.ts";
import { ConfirmationDialog } from "@/shared/ui/ConfirmationDialog.tsx";
import { Icon } from "@/shared/ui/Icon.tsx";
import { TooltipIconButton } from "@/shared/ui/TooltipIconButton.tsx";
import { Button } from "@/shared/ui/shadcn/button.tsx";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/shadcn/card.tsx";
import {
  type BookAudioRow,
  useBookAudioStorage,
} from "@/pages/settings/model/use-book-audio-storage.ts";

export function BookAudioCard() {
  const m = useMessages();
  const storage = useBookAudioStorage();
  const confirmation = () => {
    const deleting = storage.deleting;
    if (deleting === "all")
      return {
        title: m.bookAudio.deleteAllTitle,
        message: m.bookAudio.deleteAllMessage(formatMegabytes(storage.bytes)),
      };
    if (!deleting) return null;
    const row = storage.rows.find((entry) => entry.audio === deleting);
    return {
      title: m.bookAudio.deleteTitle,
      message: m.bookAudio.deleteMessage(row?.title ?? "", formatMegabytes(deleting.bytes)),
    };
  };

  return (
    <Card class="w-full max-w-2xl shrink-0">
      <CardHeader>
        <CardTitle>{m.bookAudio.settingsTitle}</CardTitle>
        <CardDescription>{m.bookAudio.settingsDescription}</CardDescription>
        <Show when={storage.rows.length > 0}>
          <CardAction class="text-sm font-medium tabular-nums">
            {formatMegabytes(storage.bytes)}
          </CardAction>
        </Show>
      </CardHeader>
      <CardContent class="flex flex-col gap-3">
        <Show
          when={storage.rows.length > 0}
          fallback={<p class="text-sm text-muted-foreground">{m.bookAudio.empty}</p>}
        >
          <For each={storage.rows} keyed={(row) => `${row.audio.documentId}-${row.audio.speaker}`}>
            {(row) => <AudioRow row={row()} onDelete={() => storage.askToDelete(row().audio)} />}
          </For>
          <Show when={storage.rows.length > 1}>
            <Button
              variant="outline"
              size="sm"
              class="self-end"
              onClick={() => storage.askToDelete("all")}
            >
              {m.bookAudio.deleteAll}
            </Button>
          </Show>
        </Show>
      </CardContent>
      <Show when={confirmation()}>
        {(text) => (
          <ConfirmationDialog
            open
            onClose={storage.closeDelete}
            onConfirm={storage.confirmDelete}
            title={text().title}
            message={text().message}
            confirmLabel={m.common.delete}
            destructive
            loading={storage.deletePending}
          />
        )}
      </Show>
    </Card>
  );
}

function AudioRow(props: { row: BookAudioRow; onDelete: () => void }) {
  const m = useMessages();
  const detail = () => {
    const { audio, done, total, preparing } = props.row;
    const parts = [
      SPEAKER_NAMES[audio.speaker],
      m.bookAudio.chapters(audio.from + 1, audio.to + 1),
    ];
    if (preparing) parts.push(m.bookAudio.preparingNow);
    else if (done < total) parts.push(m.bookAudio.readyOf(done, total));
    return parts.join(" · ");
  };

  return (
    <div class="flex items-center gap-3 rounded-lg border p-3">
      <div class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary-text">
        <Icon icon={Headphones} class="size-4" />
      </div>
      <div class="flex min-w-0 flex-1 flex-col gap-0.5">
        <span lang="zh" class="truncate font-medium">
          {props.row.title}
        </span>
        <span class="truncate text-sm text-muted-foreground">{detail()}</span>
      </div>
      <span class="text-sm text-muted-foreground tabular-nums">
        {formatMegabytes(props.row.audio.bytes)}
      </span>
      <TooltipIconButton
        label={m.bookAudio.deleteLabel(props.row.title)}
        variant="ghost"
        size="icon"
        class="text-destructive"
        onClick={() => props.onDelete()}
      >
        <Icon icon={Trash2} />
      </TooltipIconButton>
    </div>
  );
}
