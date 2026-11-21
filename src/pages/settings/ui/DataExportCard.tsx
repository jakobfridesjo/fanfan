import { Show } from "solid-js";
import { Download, LoaderCircle } from "lucide";
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
import { useDataExport } from "@/pages/settings/model/use-data-export.ts";

export function DataExportCard() {
  const m = useMessages();
  const backup = useDataExport();

  return (
    <Card class="w-full max-w-2xl shrink-0">
      <CardHeader>
        <CardTitle>{m.settings.data}</CardTitle>
        <CardDescription>{m.settings.dataDescription}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="outline" disabled={backup.exporting} onClick={backup.exportData}>
          <Show
            when={backup.exporting}
            fallback={<Icon icon={Download} data-icon="inline-start" />}
          >
            <Icon
              icon={LoaderCircle}
              data-icon="inline-start"
              class="animate-spin motion-reduce:animate-none"
            />
          </Show>
          {m.settings.exportData}
        </Button>
      </CardContent>
    </Card>
  );
}
