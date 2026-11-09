import { useState } from "react";
import { ThirdPartyLicensesSheet } from "@/pages/about/ui/ThirdPartyLicensesSheet.tsx";
import { appVersion, buildTime } from "@/shared/config/env.ts";
import { useMessages } from "@/shared/i18n/messages.ts";
import type { Messages } from "@/shared/i18n/messages-en.ts";
import { formatShortDate } from "@/shared/lib/date.ts";
import { AppLogo } from "@/shared/ui/AppLogo.tsx";
import { PageHeader } from "@/shared/ui/PageHeader.tsx";
import { Button } from "@/shared/ui/shadcn/button.tsx";
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
  { role: "cangjie", name: "Unihan (Unicode)", license: "Unicode-3.0" },
  { role: "speech", name: "MOSS-TTS-Nano", license: "Apache-2.0" },
  { role: "segmentation", name: "jieba-rs", license: "MIT" },
  { role: "scheduling", name: "FSRS (rs-fsrs)", license: "MIT" },
];

function AboutPage() {
  const m = useMessages();
  const [licensesOpen, setLicensesOpen] = useState(false);

  return (
    <>
      <PageHeader title={m.about.title} />

      <div className="-m-1 flex min-h-0 flex-col items-center gap-4 overflow-y-auto p-1">
        <Card className="w-full max-w-2xl shrink-0">
          <CardContent className="flex flex-col items-center gap-3 py-4 text-center">
            <AppLogo className="size-16" />
            <h2 lang="zh" className="text-2xl font-semibold">
              翻翻
            </h2>
            <p className="text-muted-foreground">{m.about.tagline}</p>
            <p className="text-sm">{m.about.author(AUTHOR)}</p>
            <p className="text-sm text-muted-foreground tabular-nums">
              {m.about.version(appVersion)}
              {buildTime !== "unknown" && ` · ${m.about.built(formatShortDate(buildTime))}`}
            </p>
          </CardContent>
        </Card>

        <Card className="w-full max-w-2xl shrink-0">
          <CardHeader>
            <CardTitle>{m.about.creditsTitle}</CardTitle>
            <CardDescription>{m.about.creditsDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="divide-y rounded-lg border">
              {CREDITS.map(({ role, name, license }) => (
                <div key={role} className="flex flex-wrap items-baseline gap-x-4 px-3 py-2">
                  <dt className="flex-1 text-muted-foreground">{m.about.credits[role]}</dt>
                  <dd className="font-medium">{name}</dd>
                  <dd className="w-28 text-right text-sm text-muted-foreground">{license}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <Card className="w-full max-w-2xl shrink-0">
          <CardHeader>
            <CardTitle>{m.about.licensesTitle}</CardTitle>
            <CardDescription>{m.about.licensesDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => setLicensesOpen(true)}>
              {m.about.showLicenses}
            </Button>
          </CardContent>
        </Card>
      </div>

      <ThirdPartyLicensesSheet open={licensesOpen} onOpenChange={setLicensesOpen} />
    </>
  );
}

export default AboutPage;
