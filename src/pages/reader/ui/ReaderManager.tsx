import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Pause,
  Play,
  Square,
} from "lucide-react";
import type {
  ReaderSection,
  ReaderToken,
  SpokenPhrase,
  StudyCard,
  WordStatus,
} from "@/shared/api/commands.ts";
import { useMessages } from "@/shared/i18n/messages.ts";
import { cn } from "@/shared/lib/class-names.ts";
import { ConfirmationDialog } from "@/shared/ui/ConfirmationDialog.tsx";
import { UnavailableState } from "@/shared/ui/EmptyStates.tsx";
import { FitSelectContent } from "@/shared/ui/FitSelectContent.tsx";
import { PageHeader } from "@/shared/ui/PageHeader.tsx";
import { SelectDisplayValue } from "@/shared/ui/SelectDisplayValue.tsx";
import { TooltipIconButton } from "@/shared/ui/TooltipIconButton.tsx";
import { Badge } from "@/shared/ui/shadcn/badge.tsx";
import { Button } from "@/shared/ui/shadcn/button.tsx";
import { Card, CardContent } from "@/shared/ui/shadcn/card.tsx";
import { Select, SelectGroup, SelectItem, SelectTrigger } from "@/shared/ui/shadcn/select.tsx";
import { Skeleton } from "@/shared/ui/shadcn/skeleton.tsx";
import { Readings, SpeakButton } from "@/entities/word/ui/WordCard.tsx";
import type { ReadAloudStatus } from "@/pages/reader/model/use-read-aloud.ts";
import {
  useReaderManager,
  type ReaderWordStatus,
} from "@/pages/reader/model/use-reader-manager.ts";

/** A first guess at a paragraph's height in pixels, before it is measured. */
const ESTIMATED_PARAGRAPH_HEIGHT = 96;

const WORD_STATUS_CLASS: Record<NonNullable<ReaderWordStatus>, string> = {
  unseen: "bg-primary/10 hover:bg-primary/20",
  learning: "bg-warning/25 hover:bg-warning/40",
  known: "hover:bg-muted",
};

function ReaderManager({ documentId }: { documentId: number }) {
  const navigate = useNavigate();
  const m = useMessages();
  const reader = useReaderManager(documentId);
  const sectionTitle = (position: number) =>
    reader.titles[position] ?? m.reader.untitledSection(position + 1);

  return (
    <>
      <PageHeader
        title={<span lang="zh">{reader.document?.title ?? m.reader.book}</span>}
        onBack={() => void navigate({ to: "/library" })}
        backLabel={m.reader.backToLibrary}
      >
        {reader.titles.length > 1 && reader.position !== null && (
          <Select
            value={`${reader.position}`}
            onValueChange={(value) => reader.goToSection(Number(value))}
          >
            <SelectTrigger aria-label={m.reader.section} className="max-w-64">
              <SelectDisplayValue
                options={reader.titles.map((_title, position) => ({
                  value: `${position}`,
                  label: <span lang="zh">{sectionTitle(position)}</span>,
                }))}
              />
            </SelectTrigger>
            <FitSelectContent align="end">
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
        )}
        <ReadAloudControls
          status={reader.readAloudStatus}
          loading={reader.readAloudLoading}
          disabled={!reader.section}
          onToggle={reader.toggleReadAloud}
          onStop={reader.stopReadAloud}
        />
        <TooltipIconButton
          label={m.reader.markNewKnown}
          variant="outline"
          size="icon"
          onClick={reader.askToMarkNewKnown}
          disabled={reader.newWordCount === 0}
        >
          <CheckCheck />
        </TooltipIconButton>
      </PageHeader>

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
              selectedWord={reader.selectedWord}
              onSelectToken={reader.selectToken}
              spokenPhrase={reader.spokenPhrase}
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

        <aside className="-m-1 w-80 shrink-0 overflow-y-auto p-1">
          <WordPanel
            word={reader.selectedWord}
            card={reader.wordCard}
            loading={reader.wordCardLoading}
            failed={reader.wordCardFailed}
            status={reader.selectedWord ? reader.statusOf(reader.selectedWord) : null}
            onSetStatus={reader.setStatus}
          />
        </aside>
      </div>

      <ConfirmationDialog
        open={reader.confirmingMarkNewKnown}
        onClose={reader.cancelMarkNewKnown}
        onConfirm={reader.markNewKnown}
        title={m.reader.markNewKnownTitle}
        message={m.reader.markNewKnownMessage(reader.newWordCount)}
        confirmLabel={m.reader.markKnown}
        loading={reader.markingNewKnown}
      />
    </>
  );
}

interface SectionTextProps {
  section: ReaderSection;
  /** Scrolled to on mount; later changes are ignored. */
  initialParagraph: number;
  onParagraphReached: (paragraph: number) => void;
  statusOf: (word: string) => ReaderWordStatus;
  selectedWord: string | null;
  onSelectToken: SelectToken;
  spokenPhrase: SpokenPhrase | null;
  footer: ReactNode;
}

type SelectToken = (word: string, position: { paragraph: number; token: number }) => void;

/** Only the paragraphs in view are rendered: one EPUB chapter can be a whole book. */
function SectionText({
  section,
  initialParagraph,
  onParagraphReached,
  statusOf,
  selectedWord,
  onSelectToken,
  spokenPhrase,
  footer,
}: SectionTextProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  // oxlint-disable-next-line react/incompatible-library -- the compiler skips this component; its props are plain data
  const virtualizer = useVirtualizer({
    count: section.paragraphs.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ESTIMATED_PARAGRAPH_HEIGHT,
    overscan: 6,
    onChange: (instance) => {
      const first = instance.range?.startIndex;
      if (first !== undefined) onParagraphReached(first);
    },
  });

  const restored = useRef(false);
  useLayoutEffect(() => {
    if (restored.current) return;
    restored.current = true;
    if (initialParagraph > 0) virtualizer.scrollToIndex(initialParagraph, { align: "start" });
  }, [virtualizer, initialParagraph]);

  const spokenParagraph = spokenPhrase?.paragraph;
  useEffect(() => {
    if (spokenParagraph !== undefined)
      virtualizer.scrollToIndex(spokenParagraph, { align: "auto" });
  }, [virtualizer, spokenParagraph]);

  return (
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto" data-testid="reader-text">
      <div
        className="relative mx-auto w-full max-w-2xl"
        style={{ height: virtualizer.getTotalSize() }}
      >
        {virtualizer.getVirtualItems().map((item) => (
          <div
            key={item.key}
            data-index={item.index}
            ref={virtualizer.measureElement}
            className="absolute inset-x-0 top-0 pb-5"
            style={{ transform: `translateY(${item.start}px)` }}
          >
            <Paragraph
              index={item.index}
              tokens={section.paragraphs[item.index] ?? []}
              statusOf={statusOf}
              selectedWord={selectedWord}
              onSelectToken={onSelectToken}
              spoken={spokenPhrase?.paragraph === item.index ? spokenPhrase : null}
            />
          </div>
        ))}
      </div>
      {footer}
    </div>
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

function ReadAloudControls({
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

interface ParagraphProps {
  index: number;
  tokens: ReaderToken[];
  statusOf: (word: string) => ReaderWordStatus;
  selectedWord: string | null;
  onSelectToken: SelectToken;
  /** The phrase being read aloud, when it is in this paragraph. */
  spoken: SpokenPhrase | null;
}

/** A soft line under the phrase being read aloud. */
const SPOKEN_CLASS =
  "underline decoration-primary/50 decoration-2 underline-offset-[0.4em] [text-decoration-skip-ink:none]";

function Paragraph({
  index: paragraph,
  tokens,
  statusOf,
  selectedWord,
  onSelectToken,
  spoken,
}: ParagraphProps) {
  return (
    <p lang="zh" className="text-xl leading-loose">
      {tokens.map((token, index) => {
        const key = `${index}`;
        const isSpoken = spoken !== null && index >= spoken.start && index < spoken.end;
        const spokenProps = isSpoken ? { "data-spoken": true } : {};
        if (!token.word) {
          return (
            <span key={key} {...spokenProps} className={cn(isSpoken && SPOKEN_CLASS)}>
              {token.text}
            </span>
          );
        }
        const word = token.word;
        const status = statusOf(word);
        return (
          <button
            key={key}
            type="button"
            aria-pressed={word === selectedWord}
            data-status={status ?? undefined}
            {...spokenProps}
            onClick={() => onSelectToken(word, { paragraph, token: index })}
            className={cn(
              "cursor-pointer rounded-sm px-px transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none",
              status && WORD_STATUS_CLASS[status],
              word === selectedWord && "ring-2 ring-ring",
              isSpoken && SPOKEN_CLASS
            )}
          >
            {token.text}
          </button>
        );
      })}
    </p>
  );
}

interface WordPanelProps {
  word: string | null;
  card: StudyCard | undefined;
  loading: boolean;
  failed: boolean;
  status: ReaderWordStatus;
  onSetStatus: (word: string, status: WordStatus) => void;
}

function WordPanel({ word, card, loading, failed, status, onSetStatus }: WordPanelProps) {
  const m = useMessages();
  if (!word) {
    return (
      <Card size="sm">
        <CardContent>
          <p className="text-sm text-muted-foreground">{m.reader.pickWord}</p>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card size="sm" aria-label={word}>
      <CardContent className="flex flex-col gap-4">
        {loading ? (
          <Skeleton className="h-32 w-full motion-reduce:animate-none" />
        ) : failed || !card ? (
          <p className="text-sm text-muted-foreground">{m.reader.wordFailed}</p>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <p lang="zh" className="text-4xl font-medium tracking-wide">
                {card.displayWord}
              </p>
              <SpeakButton word={card.word} />
              {status && (
                <Badge variant="outline" className="ml-auto">
                  {m.reader.statuses[status]}
                </Badge>
              )}
            </div>
            <Readings card={card} />
          </>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant={status === "learning" ? "default" : "outline"}
            disabled={status === "learning"}
            onClick={() => onSetStatus(word, "learning")}
          >
            {m.reader.learnIt}
          </Button>
          <Button
            type="button"
            variant={status === "known" ? "default" : "outline"}
            disabled={status === "known"}
            onClick={() => onSetStatus(word, "known")}
          >
            {m.reader.knowIt}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default ReaderManager;
