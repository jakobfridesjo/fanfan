import { LoaderCircle, Pause, Play, Square } from "lucide-react";
import { useMessages } from "@/shared/i18n/messages.ts";
import { TooltipIconButton } from "@/shared/ui/TooltipIconButton.tsx";
import type { ReadAloudStatus } from "@/pages/reader/model/use-read-aloud.ts";

export function ReadAloudControls({
  status,
  loading,
  disabled,
  onToggle,
  onStop,
}: {
  status: ReadAloudStatus;
  loading: boolean;
  disabled: boolean;
  onToggle: () => void;
  onStop: () => void;
}) {
  const m = useMessages();
  const label = {
    stopped: m.reader.readAloud,
    playing: m.reader.pauseReading,
    paused: m.reader.resumeReading,
  }[status];
  return (
    <>
      {status !== "stopped" && (
        <TooltipIconButton
          label={m.reader.stopReading}
          variant="outline"
          size="icon"
          onClick={onStop}
        >
          <Square />
        </TooltipIconButton>
      )}
      <TooltipIconButton
        label={label}
        variant="outline"
        size="icon"
        disabled={disabled}
        onClick={onToggle}
      >
        {status !== "playing" ? (
          <Play />
        ) : loading ? (
          <LoaderCircle className="animate-spin motion-reduce:animate-none" />
        ) : (
          <Pause />
        )}
      </TooltipIconButton>
    </>
  );
}
