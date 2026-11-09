import { ChevronRightIcon } from "lucide-react";
import { useThirdPartyLicenses } from "@/pages/about/model/use-third-party-licenses.ts";
import { useMessages } from "@/shared/i18n/messages.ts";
import { Alert, AlertDescription } from "@/shared/ui/shadcn/alert.tsx";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/shared/ui/shadcn/collapsible.tsx";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/shared/ui/shadcn/sheet.tsx";
import { Spinner } from "@/shared/ui/shadcn/spinner.tsx";

type ThirdPartyLicensesSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ThirdPartyLicensesSheet({ open, onOpenChange }: ThirdPartyLicensesSheetProps) {
  const m = useMessages();
  const notices = useThirdPartyLicenses(open);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{m.about.licensesTitle}</SheetTitle>
          <SheetDescription>{m.about.licensesDescription}</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
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
        </div>
      </SheetContent>
    </Sheet>
  );
}
