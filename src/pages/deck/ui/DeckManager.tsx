import { Link, useNavigate } from "@tanstack/react-router";
import { Check, PartyPopper, Undo2, X } from "lucide-react";
import type { Deck } from "@/shared/api/commands.ts";
import { useMessages } from "@/shared/i18n/messages.ts";
import { UnavailableState } from "@/shared/ui/EmptyStates.tsx";
import { PageHeader } from "@/shared/ui/PageHeader.tsx";
import { SwipeCard } from "@/shared/ui/SwipeCard.tsx";
import { TooltipIconButton } from "@/shared/ui/TooltipIconButton.tsx";
import { Button, buttonVariants } from "@/shared/ui/shadcn/button.tsx";
import { Card, CardContent } from "@/shared/ui/shadcn/card.tsx";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/shared/ui/shadcn/empty.tsx";
import { Skeleton } from "@/shared/ui/shadcn/skeleton.tsx";
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
      >
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
      </PageHeader>

      <div className="-m-1 flex min-h-0 flex-1 flex-col items-center gap-6 overflow-x-hidden overflow-y-auto p-1">
        {deck && <ProgressCard deck={deck} />}

        {loading || refilling ? (
          <Skeleton className="h-96 w-full max-w-xl rounded-3xl motion-reduce:animate-none" />
        ) : failed ? (
          <UnavailableState description={m.deck.loadFailedDescription} />
        ) : current ? (
          <div className="flex w-full max-w-xl flex-1 flex-col gap-6 pb-6">
            <div className="flex flex-1 flex-col justify-center">
              <SwipeCard key={current.word} onSwipe={answer}>
                <WordCard card={current} />
              </SwipeCard>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button type="button" variant="outline" size="lg" onClick={() => answer("left")}>
                <X data-icon="inline-start" />
                {m.deck.learnIt}
              </Button>
              <Button type="button" size="lg" onClick={() => answer("right")}>
                <Check data-icon="inline-start" />
                {m.deck.knowIt}
              </Button>
            </div>
          </div>
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
      </div>
    </>
  );
}

function ProgressCard({ deck }: { deck: Deck }) {
  const m = useMessages();
  const { document, wordsTo95, wordsTo98 } = deck;
  const goal =
    wordsTo98 === 0
      ? m.deck.goalReached
      : wordsTo95 === 0
        ? m.deck.goalTo98(wordsTo98)
        : m.deck.goalTo95(wordsTo95, wordsTo98);

  return (
    <Card size="sm" className="w-full max-w-xl shrink-0">
      <CardContent className="flex flex-col gap-3">
        <CoverageBar document={document} />
        <p className="text-sm">{goal}</p>
      </CardContent>
    </Card>
  );
}

export default DeckManager;
