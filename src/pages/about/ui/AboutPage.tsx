import { Link, useNavigate } from "@tanstack/solid-router";
import { For, Show } from "solid-js";
import { appVersion, buildTime } from "@/shared/config/env.ts";
import { useMessages } from "@/shared/i18n/messages.ts";
import type { Messages } from "@/shared/i18n/messages-en.ts";
import { formatShortDate } from "@/shared/lib/date.ts";
import { AppLogo } from "@/shared/ui/AppLogo.tsx";
import { PageHeader } from "@/shared/ui/PageHeader.tsx";
import { buttonVariants } from "@/shared/ui/shadcn/button.tsx";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/shadcn/card.tsx";

const AUTHOR = "Jakob Fridesjö";

const CREDITS: { role: keyof Messages["about"]["credits"]; name: string; license: string }[] = [
  { role: "dictionary", name: "CC-CEDICT", license: "CC BY-SA 4.0" },
  { role: "hsk", name: "complete-hsk-vocabulary", license: "MIT" },
  { role: "tbcl", name: "TBCL (NAER)", license: "NAER open data" },
  { role: "tocfl", name: "LinZi (linzi.app)", license: "CC BY-SA 4.0" },
  { role: "cangjie", name: "Unihan (Unicode)", license: "Unicode-3.0" },
  { role: "speech", name: "MOSS-TTS-Nano", license: "Apache-2.0" },
  { role: "translation", name: "opus-mt-zh-en (Helsinki-NLP)", license: "CC BY 4.0" },
  { role: "segmentation", name: "jieba-rs", license: "MIT" },
  { role: "scheduling", name: "FSRS (rs-fsrs)", license: "MIT" },
];

function AboutPage() {
  const m = useMessages();
  const navigate = useNavigate();

  return (
    <>
      <PageHeader title={m.about.title} onBack={() => void navigate({ to: "/settings" })} />

      <div class="-m-1 flex min-h-0 flex-col items-center gap-4 overflow-y-auto p-1 scroll-fade">
        <Card class="w-full max-w-2xl shrink-0">
          <CardContent class="flex flex-col items-center gap-3 py-4 text-center">
            <AppLogo class="size-16" />
            <h2 lang="zh" class="text-2xl font-semibold">
              翻翻
            </h2>
            <p class="text-muted-foreground">{m.about.tagline}</p>
            <p class="text-sm">{m.about.author(AUTHOR)}</p>
            <p class="text-sm text-muted-foreground tabular-nums">
              {m.about.version(appVersion)}
              <Show when={buildTime !== "unknown"}>
                {` · ${m.about.built(formatShortDate(buildTime))}`}
              </Show>
            </p>
          </CardContent>
        </Card>

        <Card class="w-full max-w-2xl shrink-0">
          <CardHeader>
            <CardTitle>{m.about.creditsTitle}</CardTitle>
            <CardDescription>{m.about.creditsDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            <dl class="divide-y rounded-lg border">
              <For each={CREDITS}>
                {(credit) => (
                  <div class="flex flex-wrap items-baseline gap-x-4 px-3 py-2">
                    <dt class="flex-1 text-muted-foreground">{m.about.credits[credit.role]}</dt>
                    <dd class="font-medium">{credit.name}</dd>
                    <dd class="w-28 text-right text-sm text-muted-foreground">{credit.license}</dd>
                  </div>
                )}
              </For>
            </dl>
          </CardContent>
        </Card>

        <Card class="w-full max-w-2xl shrink-0">
          <CardHeader>
            <CardTitle>{m.about.licensesTitle}</CardTitle>
            <CardDescription>{m.about.licensesDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/about/licenses" class={buttonVariants({ variant: "outline" })}>
              {m.about.showLicenses}
            </Link>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

export default AboutPage;
