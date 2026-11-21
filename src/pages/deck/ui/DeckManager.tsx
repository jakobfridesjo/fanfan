import { Link, useNavigate } from "@tanstack/solid-router";
import { Check, PartyPopper, Undo2, X } from "lucide";
import { createMemo, Match, Show, Switch } from "solid-js";
import type { DocumentSummary } from "@/shared/api/commands.ts";
import { useMessages } from "@/shared/i18n/messages.ts";
import { UnavailableState } from "@/shared/ui/EmptyStates.tsx";
import { Icon } from "@/shared/ui/Icon.tsx";
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

function DeckManager(props: { documentId: number }) {
  const navigate = useNavigate();
  const m = useMessages();
  // The route mounts a fresh manager per book.
  const deck = useDeckManager(props.documentId);
  // A fresh card per word: the last one has flung off-screen.
  const currentWord = createMemo(() => deck.current?.word);

  return (
    <>
      <PageHeader
        title={<span lang="zh">{deck.deck?.document.title ?? m.deck.book}</span>}
        onBack={() => void navigate({ to: "/library" })}
        backLabel={m.deck.backToLibrary}
        action={
          <TooltipIconButton
            label={m.deck.undo}
            tooltip={m.deck.undoTooltip}
            variant="outline"
            size="icon"
            onClick={deck.undo}
            disabled={!deck.canUndo}
          >
            <Icon icon={Undo2} />
          </TooltipIconButton>
        }
      />

      <StudyStage
        status={
          <Show when={deck.deck}>{(loaded) => <DeckProgress document={loaded().document} />}</Show>
        }
      >
        <Switch>
          <Match when={deck.loading || deck.refilling}>
            <StudySkeleton />
          </Match>
          <Match when={deck.failed}>
            <UnavailableState description={m.deck.loadFailedDescription} />
          </Match>
          <Match when={deck.current}>
            {(current) => (
              <StudySession
                card={
                  <Show when={currentWord()} keyed>
                    {(_word) => (
                      <SwipeCard onSwipe={deck.answer} class="flex min-h-96 flex-col">
                        <WordCard card={current()} />
                      </SwipeCard>
                    )}
                  </Show>
                }
                actions={
                  <div class="grid grid-cols-2 gap-2">
                    <Button variant="outline" size="lg" onClick={() => deck.answer("left")}>
                      <Icon icon={X} data-icon="inline-start" />
                      {m.deck.learnIt}
                    </Button>
                    <Button size="lg" onClick={() => deck.answer("right")}>
                      <Icon icon={Check} data-icon="inline-start" />
                      {m.deck.knowIt}
                    </Button>
                  </div>
                }
                hint={m.deck.answerHint}
              />
            )}
          </Match>
          <Match when={true}>
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Icon icon={PartyPopper} />
                </EmptyMedia>
                <EmptyTitle>{m.deck.doneTitle}</EmptyTitle>
                <EmptyDescription>{m.deck.doneDescription}</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Link to="/review" search={{ document: props.documentId }} class={buttonVariants()}>
                  {m.deck.reviewWords}
                </Link>
              </EmptyContent>
            </Empty>
          </Match>
        </Switch>
      </StudyStage>
    </>
  );
}

function DeckProgress(props: { document: DocumentSummary }) {
  const m = useMessages();
  return (
    <>
      <CoverageBar document={props.document} />
      <p class="text-sm text-muted-foreground">
        {m.deck.sortedWords(
          props.document.uniqueWords - props.document.unseenWords,
          props.document.uniqueWords
        )}
      </p>
    </>
  );
}

export default DeckManager;
