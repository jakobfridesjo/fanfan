import { LoaderCircle, Pause, Play, Square } from "lucide";
import { Match, Show, Switch } from "solid-js";
import { useMessages } from "@/shared/i18n/messages.ts";
import { Icon } from "@/shared/ui/Icon.tsx";
import { TooltipIconButton } from "@/shared/ui/TooltipIconButton.tsx";
import type { ReadAloudStatus } from "@/pages/reader/model/use-read-aloud.ts";

export function ReadAloudControls(props: {
  status: ReadAloudStatus;
  loading: boolean;
  disabled: boolean;
  onToggle: () => void;
  onStop: () => void;
}) {
  const m = useMessages();
  const label = () =>
    ({
      stopped: m.reader.readAloud,
      playing: m.reader.pauseReading,
      paused: m.reader.resumeReading,
    })[props.status];
  return (
    <>
      <Show when={props.status !== "stopped"}>
        <TooltipIconButton
          label={m.reader.stopReading}
          variant="outline"
          size="icon"
          onClick={() => props.onStop()}
        >
          <Icon icon={Square} />
        </TooltipIconButton>
      </Show>
      <TooltipIconButton
        label={label()}
        variant="outline"
        size="icon"
        disabled={props.disabled}
        onClick={() => props.onToggle()}
      >
        <Switch fallback={<Icon icon={Pause} />}>
          <Match when={props.status !== "playing"}>
            <Icon icon={Play} />
          </Match>
          <Match when={props.loading}>
            <Icon icon={LoaderCircle} class="animate-spin motion-reduce:animate-none" />
          </Match>
        </Switch>
      </TooltipIconButton>
    </>
  );
}
