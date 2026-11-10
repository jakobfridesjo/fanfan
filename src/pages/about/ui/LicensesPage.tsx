import { ChevronRightIcon } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useThirdPartyLicenses } from "@/pages/about/model/use-third-party-licenses.ts";
import { useMessages } from "@/shared/i18n/messages.ts";
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

      <div className="-m-1 flex min-h-0 flex-col items-center gap-4 overflow-y-auto p-1 scroll-fade">
        <Card className="w-full max-w-2xl shrink-0">
          <CardHeader>
            <CardTitle>{m.about.licensesTitle}</CardTitle>
            <CardDescription>{m.about.licensesDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            {notices.isPending && <Spinner className="mx-auto" />}
            {notices.isError && (
              <Alert variant="destructive">
                <AlertDescription>{m.about.licensesLoadError}</AlertDescription>
              </Alert>
            )}
            {notices.data && (
              <ul className="divide-y rounded-lg border">
                {notices.data.map((notice) => (
                  <li key={`${notice.license} ${notice.packages[0]}`}>
                    <Collapsible>
                      <CollapsibleTrigger className="group flex w-full items-start gap-2 px-3 py-2 text-left">
                        <ChevronRightIcon className="mt-0.5 size-4 shrink-0 transition-transform group-data-panel-open:rotate-90" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">
                            {notice.packages.join(", ")}
                          </span>
                          <span className="text-muted-foreground">
                            {notice.license} · {m.about.packages(notice.packages.length)}
                          </span>
                        </span>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="flex flex-col gap-2 px-3 pb-3">
                        <p className="text-muted-foreground">{notice.packages.join(", ")}</p>
                        <pre className="overflow-x-auto rounded-lg border p-3 text-xs whitespace-pre-wrap">
                          {notice.text}
                        </pre>
                      </CollapsibleContent>
                    </Collapsible>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

export default LicensesPage;
