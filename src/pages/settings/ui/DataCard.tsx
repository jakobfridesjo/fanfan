import type { JSX } from "@solidjs/web";
import { Show } from "solid-js";
import { Download, type IconNode, LoaderCircle, Upload } from "lucide";
import { useMessages } from "@/shared/i18n/messages.ts";
import { Icon } from "@/shared/ui/Icon.tsx";
import { Button } from "@/shared/ui/shadcn/button.tsx";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/shadcn/card.tsx";
import { useDataBackup } from "@/pages/settings/model/use-data-backup.ts";

function BackupButton(props: {
  icon: IconNode;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
  children: JSX.Element;
}) {
  return (
    <Button variant="outline" disabled={props.disabled} onClick={props.onClick}>
      <Show when={props.busy} fallback={<Icon icon={props.icon} data-icon="inline-start" />}>
        <Icon
          icon={LoaderCircle}
          data-icon="inline-start"
          class="animate-spin motion-reduce:animate-none"
        />
      </Show>
      {props.children}
    </Button>
  );
}

export function DataCard() {
  const m = useMessages();
  const backup = useDataBackup();
  const busy = () => backup.exporting || backup.importing;

  return (
    <Card class="w-full max-w-2xl shrink-0">
      <CardHeader>
        <CardTitle>{m.settings.data}</CardTitle>
        <CardDescription>{m.settings.dataDescription}</CardDescription>
      </CardHeader>
      <CardContent class="flex flex-wrap gap-2">
        <BackupButton
          icon={Download}
          busy={backup.exporting}
          disabled={busy()}
          onClick={backup.exportData}
        >
          {m.settings.exportData}
        </BackupButton>
        <BackupButton
          icon={Upload}
          busy={backup.importing}
          disabled={busy()}
          onClick={backup.importData}
        >
          {m.settings.importData}
        </BackupButton>
      </CardContent>
    </Card>
  );
}
