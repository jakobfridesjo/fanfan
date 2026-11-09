import { useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMessages } from "@/shared/i18n/messages.ts";
import { UnavailableState } from "@/shared/ui/EmptyStates.tsx";
import { FitSelectContent } from "@/shared/ui/FitSelectContent.tsx";
import { PageHeader } from "@/shared/ui/PageHeader.tsx";
import { SelectDisplayValue } from "@/shared/ui/SelectDisplayValue.tsx";
import { Button } from "@/shared/ui/shadcn/button.tsx";
import { Select, SelectGroup, SelectItem, SelectTrigger } from "@/shared/ui/shadcn/select.tsx";
import { Skeleton } from "@/shared/ui/shadcn/skeleton.tsx";
import { useIsMobile } from "@/shared/lib/use-mobile.ts";
import { useReaderManager } from "@/pages/reader/model/use-reader-manager.ts";
import { ReadAloudControls } from "@/pages/reader/ui/ReadAloudControls.tsx";
import { SectionText } from "@/pages/reader/ui/SectionText.tsx";
import { WordDrawer } from "@/pages/reader/ui/WordDrawer.tsx";
import { WordPanel } from "@/pages/reader/ui/WordPanel.tsx";

function ReaderManager({ documentId }: { documentId: number }) {
  const navigate = useNavigate();
  const m = useMessages();
  const reader = useReaderManager(documentId);
  const isMobile = useIsMobile();
  const wordPanel = {
    word: reader.selectedWord,
    card: reader.wordCard,
    loading: reader.wordCardLoading,
    failed: reader.wordCardFailed,
    status: reader.selectedWord ? reader.statusOf(reader.selectedWord) : null,
    onSetStatus: reader.setStatus,
  };
  const sectionTitle = (position: number) =>
    reader.titles[position] ?? m.reader.untitledSection(position + 1);

  return (
    <>
      <PageHeader
        title={
          <span lang="zh" className="block truncate">
            {reader.document?.title ?? m.reader.book}
          </span>
        }
        onBack={() => void navigate({ to: "/library" })}
        backLabel={m.reader.backToLibrary}
        centerInline
        center={
          reader.titles.length > 1 &&
          reader.position !== null && (
            <Select
              value={`${reader.position}`}
              onValueChange={(value) => reader.goToSection(Number(value))}
            >
              <SelectTrigger aria-label={m.reader.section} className="max-w-40 sm:max-w-64">
                <SelectDisplayValue
                  options={reader.titles.map((_title, position) => ({
                    value: `${position}`,
                    label: <span lang="zh">{sectionTitle(position)}</span>,
                  }))}
                />
              </SelectTrigger>
              <FitSelectContent align="center">
                <SelectGroup>
                  {reader.titles.map((_title, position) => (
                    // oxlint-disable-next-line react/no-array-index-key -- a section is its position
                    <SelectItem key={position} value={`${position}`}>
                      <span lang="zh">{sectionTitle(position)}</span>
                    </SelectItem>
                  ))}
                </SelectGroup>
              </FitSelectContent>
            </Select>
          )
        }
        action={
          <ReadAloudControls
            status={reader.readAloudStatus}
            loading={reader.readAloudLoading}
            disabled={!reader.section}
            onToggle={reader.toggleReadAloud}
            onStop={reader.stopReadAloud}
          />
        }
      />

      <div className="flex min-h-0 flex-1 gap-6">
        <div className="flex min-w-0 flex-1 flex-col">
          {reader.loading ? (
            <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
              {["first", "second", "third"].map((key) => (
                <Skeleton key={key} className="h-24 w-full motion-reduce:animate-none" />
              ))}
            </div>
          ) : reader.failed || !reader.section ? (
            <UnavailableState description={m.reader.loadFailedDescription} />
          ) : (
            <SectionText
              key={`${reader.section.position}`}
              section={reader.section}
              initialParagraph={reader.initialParagraph}
              onParagraphReached={reader.onParagraphReached}
              statusOf={reader.statusOf}
              selectedToken={reader.selectedToken}
              onSelectToken={reader.selectToken}
              spokenPhrase={reader.spokenPhrase}
              drawerOpen={isMobile && reader.selectedWord !== null}
              footer={
                <SectionNav
                  position={reader.section.position}
                  count={reader.titles.length}
                  onGo={reader.goToSection}
                />
              }
            />
          )}
        </div>

        {!isMobile && (
          <aside className="-m-1 w-80 shrink-0 overflow-y-auto p-1">
            <WordPanel {...wordPanel} />
          </aside>
        )}
      </div>

      {isMobile && <WordDrawer {...wordPanel} onClose={reader.deselectWord} />}
    </>
  );
}

function SectionNav({
  position,
  count,
  onGo,
}: {
  position: number;
  count: number;
  onGo: (position: number) => void;
}) {
  const m = useMessages();
  return (
    <div className="mx-auto flex w-full max-w-2xl justify-between gap-3 py-8">
      <Button
        type="button"
        variant="outline"
        disabled={position === 0}
        onClick={() => onGo(position - 1)}
      >
        <ChevronLeft data-icon="inline-start" />
        {m.reader.previousSection}
      </Button>
      <Button
        type="button"
        variant="outline"
        disabled={position >= count - 1}
        onClick={() => onGo(position + 1)}
      >
        {m.reader.nextSection}
        <ChevronRight data-icon="inline-end" />
      </Button>
    </div>
  );
}

export default ReaderManager;
