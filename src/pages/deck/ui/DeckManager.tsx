import { Link, useNavigate } from "@tanstack/react-router";
import { Check, PartyPopper, Undo2, X } from "lucide-react";
import type { DocumentSummary } from "@/shared/api/commands.ts";
import { useMessages } from "@/shared/i18n/messages.ts";
import { UnavailableState } from "@/shared/ui/EmptyStates.tsx";
import { PageHeader } from "@/shared/ui/PageHeader.tsx";
import { StudySession, StudySkeleton, StudyStage } from "@/shared/ui/StudySession.tsx";
import { SwipeCard } from "@/shared/ui/SwipeCard.tsx";
import { TooltipIconButton } from "@/shared/ui/TooltipIconButton.tsx";
import { Button, buttonVariants } from "@/shared/ui/shadcn/button.tsx";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/shared/ui/shadcn/empty.tsx";
import { CoverageBar } from "@/entities/document/ui/CoverageBar.tsx";
import { WordCard } from "@/entities/word/ui/WordCard.tsx";
import { useDeckManager } from "@/pages/deck/model/use-deck-manager.ts";

function DeckManager({ documentId }: { documentId: number }) {
  const navigate = useNavigate();
  const m = useMessages();
  const { deck, loading, failed, current, refilling, answer, canUndo, undo } =
    useDeckManager(documentId);

  const backToLibrary = () => void navigate({ to: "/library" });

  return (
    <>
      <PageHeader
        title={<span lang="zh">{deck?.document.title ?? m.deck.book}</span>}
        onBack={backToLibrary}
        backLabel={m.deck.backToLibrary}
        action={
          <TooltipIconButton
            label={m.deck.undo}
            tooltip={m.deck.undoTooltip}
            variant="outline"
            size="icon"
            onClick={undo}
            disabled={!canUndo}
          >
            <Undo2 />
          </TooltipIconButton>
        }
      />

      <StudyStage status={deck && <DeckProgress document={deck.document} />}>
        {loading || refilling ? (
          <StudySkeleton />
        ) : failed ? (
          <UnavailableState description={m.deck.loadFailedDescription} />
        ) : current ? (
          <StudySession
            card={
              <SwipeCard key={current.word} onSwipe={answer} className="flex min-h-96 flex-col">
                <WordCard card={current} />
              </SwipeCard>
            }
            actions={
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant="outline" size="lg" onClick={() => answer("left")}>
                  <X data-icon="inline-start" />
                  {m.deck.learnIt}
                </Button>
                <Button type="button" size="lg" onClick={() => answer("right")}>
                  <Check data-icon="inline-start" />
                  {m.deck.knowIt}
                </Button>
              </div>
            }
            hint={m.deck.answerHint}
          />
        ) : (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <PartyPopper />
              </EmptyMedia>
              <EmptyTitle>{m.deck.doneTitle}</EmptyTitle>
              <EmptyDescription>{m.deck.doneDescription}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Link to="/review" className={buttonVariants()}>
                {m.deck.reviewWords}
              </Link>
            </EmptyContent>
          </Empty>
        )}
      </StudyStage>
    </>
  );
}

function DeckProgress({ document }: { document: DocumentSummary }) {
  const m = useMessages();
  return (
    <>
      <CoverageBar document={document} />
      <p className="text-sm text-muted-foreground">
        {m.deck.sortedWords(document.uniqueWords - document.unseenWords, document.uniqueWords)}
      </p>
    </>
  );
}

export default DeckManager;
