import { useRef } from "react";
import { FileText } from "lucide-react";
import type { WordCounts } from "@/shared/api/commands.ts";
import { useMessages } from "@/shared/i18n/messages.ts";
import { formatInteger } from "@/shared/lib/number-format.ts";
import { PageHeader } from "@/shared/ui/PageHeader.tsx";
import { Button } from "@/shared/ui/shadcn/button.tsx";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/shadcn/card.tsx";
import { FieldGroup } from "@/shared/ui/shadcn/field.tsx";
import { Spinner } from "@/shared/ui/shadcn/spinner.tsx";
import { useKnownWordsManager } from "@/pages/known-words/model/use-known-words-manager.ts";

function KnownWordsManager() {
  const m = useMessages();
  const { counts, form, canSubmit, pending, loadFile } = useKnownWordsManager();
  const fileInput = useRef<HTMLInputElement>(null);

  return (
    <>
      <PageHeader title={m.knownWords.title} />

      <div className="-m-1 flex min-h-0 flex-col gap-4 overflow-y-auto p-1">
        <WordCountCards counts={counts} />

        <Card className="shrink-0">
          <CardHeader>
            <CardTitle>{m.knownWords.addTitle}</CardTitle>
            <CardDescription>{m.knownWords.addDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                void form.handleSubmit();
              }}
            >
              <FieldGroup>
                <form.Field name="text">
                  {(field) => (
                    <field.TextareaField
                      id="known-words-text"
                      label={m.knownWords.words}
                      lang="zh"
                      rows={10}
                      className="min-h-48"
                      placeholder={"你好\n学习\n中文"}
                      disabled={pending}
                    />
                  )}
                </form.Field>
              </FieldGroup>
              <div className="flex flex-wrap justify-end gap-2">
                <input
                  ref={fileInput}
                  type="file"
                  accept=".txt,.csv,.tsv,text/plain"
                  className="hidden"
                  aria-label={m.knownWords.file}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void loadFile(file);
                    event.target.value = "";
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInput.current?.click()}
                  disabled={pending}
                >
                  <FileText data-icon="inline-start" />
                  {m.knownWords.loadFile}
                </Button>
                <Button type="submit" disabled={!canSubmit || pending}>
                  {pending && <Spinner data-icon="inline-start" />}
                  {m.knownWords.markKnown}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function WordCountCards({ counts }: { counts: WordCounts | undefined }) {
  const m = useMessages();
  const items = [
    { label: m.knownWords.known, value: counts?.known },
    { label: m.knownWords.learning, value: counts?.learning },
    { label: m.knownWords.due, value: counts?.due },
  ];
  return (
    <div className="grid shrink-0 gap-4 sm:grid-cols-3">
      {items.map(({ label, value }) => (
        <Card key={label} size="sm">
          <CardContent className="flex flex-col gap-1">
            <span className="text-sm text-muted-foreground">{label}</span>
            <span className="text-2xl font-semibold tabular-nums">
              {value === undefined ? "–" : formatInteger(value)}
            </span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default KnownWordsManager;
