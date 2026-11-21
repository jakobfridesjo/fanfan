import { For, Show } from "solid-js";
import { ChevronRight } from "lucide";
import { useNavigate } from "@tanstack/solid-router";
import { useThirdPartyLicenses } from "@/pages/about/model/use-third-party-licenses.ts";
import { useMessages } from "@/shared/i18n/messages.ts";
import { Icon } from "@/shared/ui/Icon.tsx";
import { PageHeader } from "@/shared/ui/PageHeader.tsx";
import { Alert, AlertDescription } from "@/shared/ui/shadcn/alert.tsx";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/shadcn/card.tsx";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/shared/ui/shadcn/collapsible.tsx";
import { Spinner } from "@/shared/ui/shadcn/spinner.tsx";

function LicensesPage() {
  const m = useMessages();
  const navigate = useNavigate();
  const notices = useThirdPartyLicenses();

  return (
    <>
      <PageHeader title={m.about.licensesTitle} onBack={() => void navigate({ to: "/about" })} />

      <div class="-m-1 flex min-h-0 flex-col items-center gap-4 overflow-y-auto p-1 scroll-fade">
        <Card class="w-full max-w-2xl shrink-0">
          <CardHeader>
            <CardTitle>{m.about.licensesTitle}</CardTitle>
            <CardDescription>{m.about.licensesDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            <Show when={notices.isPending}>
              <Spinner class="mx-auto" />
            </Show>
            <Show when={notices.isError}>
              <Alert variant="destructive">
                <AlertDescription>{m.about.licensesLoadError}</AlertDescription>
              </Alert>
            </Show>
            <Show when={notices.data}>
              {(loaded) => (
                <ul class="divide-y rounded-lg border">
                  <For each={loaded()}>
                    {(notice) => (
                      <li>
                        <Collapsible>
                          <CollapsibleTrigger class="group flex w-full items-start gap-2 px-3 py-2 text-left">
                            <Icon
                              icon={ChevronRight}
                              class="mt-0.5 size-4 shrink-0 transition-transform group-data-expanded:rotate-90"
                            />
                            <span class="min-w-0 flex-1">
                              <span class="block truncate font-medium">
                                {notice.packages.join(", ")}
                              </span>
                              <span class="text-muted-foreground">
                                {notice.license} · {m.about.packages(notice.packages.length)}
                              </span>
                            </span>
                          </CollapsibleTrigger>
                          <CollapsibleContent class="flex flex-col gap-2 px-3 pb-3">
                            <p class="text-muted-foreground">{notice.packages.join(", ")}</p>
                            <pre class="overflow-x-auto rounded-lg border p-3 text-xs whitespace-pre-wrap">
                              {notice.text}
                            </pre>
                          </CollapsibleContent>
                        </Collapsible>
                      </li>
                    )}
                  </For>
                </ul>
              )}
            </Show>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

export default LicensesPage;
