import { useNavigate } from "@tanstack/solid-router";
import { ChevronLeft, ChevronRight } from "lucide";
import { createMemo, For, Match, Show, Switch } from "solid-js";
import { useMessages } from "@/shared/i18n/messages.ts";
import { UnavailableState } from "@/shared/ui/EmptyStates.tsx";
import { Icon } from "@/shared/ui/Icon.tsx";
import { PageHeader } from "@/shared/ui/PageHeader.tsx";
import { Button } from "@/shared/ui/shadcn/button.tsx";
import { Select } from "@/shared/ui/shadcn/select.tsx";
import { Skeleton } from "@/shared/ui/shadcn/skeleton.tsx";
import { useIsMobile } from "@/shared/lib/use-mobile.ts";
import { useReaderManager } from "@/pages/reader/model/use-reader-manager.ts";
import type { PassageTranslationProps } from "@/pages/reader/ui/PassageTranslation.tsx";
import { BookmarksMenu } from "@/pages/reader/ui/BookmarksMenu.tsx";
import { ReadAloudControls } from "@/pages/reader/ui/ReadAloudControls.tsx";
import { SectionText } from "@/pages/reader/ui/SectionText.tsx";
import { WordDrawer } from "@/pages/reader/ui/WordDrawer.tsx";
import { WordPanel, type WordPanelProps } from "@/pages/reader/ui/WordPanel.tsx";

function ReaderManager(props: { documentId: number }) {
  const navigate = useNavigate();
  const m = useMessages();
  const reader = useReaderManager(props.documentId);
  const isMobile = useIsMobile();
  const passagePanel: PassageTranslationProps = {
    get text() {
      return reader.passageText ?? "";
    },
    get translation() {
      return reader.translation;
    },
    get loading() {
      return reader.translationLoading;
    },
    get error() {
      return reader.translationError;
    },
    get missingTranslator() {
      return reader.missingTranslator;
    },
    onListen: reader.listenToPassage,
  };
  const wordPanel: WordPanelProps = {
    get word() {
      return reader.selectedWord;
    },
    get card() {
      return reader.wordCard;
    },
    get loading() {
      return reader.wordCardLoading;
    },
    get failed() {
      return reader.wordCardFailed;
    },
    get status() {
      return reader.selectedWord ? reader.statusOf(reader.selectedWord) : null;
    },
    onSetStatus: reader.setStatus,
    get passage() {
      return reader.passageText !== null && reader.translationShown ? passagePanel : null;
    },
  };
  const sectionTitle = (position: number) =>
    reader.titles[position] ?? m.reader.untitledSection(position + 1);
  const sectionOptions = createMemo(() =>
    reader.titles.map((_title, position) => ({
      value: `${position}`,
      label: sectionTitle(position),
      content: () => <span lang="zh">{sectionTitle(position)}</span>,
    }))
  );
  // A fresh text per section and per jump: it opens at its own place.
  const textKey = createMemo(() => reader.textKey);

  return (
    <>
      <PageHeader
        title={
          <span lang="zh" class="block truncate">
            {reader.document?.title ?? m.reader.book}
          </span>
        }
        onBack={() => void navigate({ to: "/library" })}
        backLabel={m.reader.backToLibrary}
        centerInline
        center={
          <Show when={reader.titles.length > 1 && reader.position !== null}>
            <Select
              aria-label={m.reader.section}
              class="max-w-40 sm:max-w-64"
              options={sectionOptions()}
              value={`${reader.position}`}
              onChange={(value) => {
                if (value !== null) reader.goToSection(Number(value));
              }}
            />
          </Show>
        }
        action={
          <>
            <BookmarksMenu
              bookmarks={reader.bookmarks}
              bookmarked={reader.bookmarked}
              saving={reader.bookmarkSaving}
              disabled={!reader.section}
              sectionTitle={sectionTitle}
              onToggle={reader.toggleBookmark}
              onGo={reader.goToBookmark}
              onDelete={reader.deleteBookmark}
            />
            <ReadAloudControls
              status={reader.readAloudStatus}
              loading={reader.readAloudLoading}
              disabled={!reader.section}
              onToggle={reader.toggleReadAloud}
              onStop={reader.stopReadAloud}
            />
          </>
        }
      />

      <div class="flex min-h-0 flex-1 gap-6">
        <div class="flex min-w-0 flex-1 flex-col">
          <Switch fallback={<UnavailableState description={m.reader.loadFailedDescription} />}>
            <Match when={reader.loading}>
              <div class="mx-auto flex w-full max-w-2xl flex-col gap-4">
                <For each={["first", "second", "third"]}>
                  {() => <Skeleton class="h-24 w-full motion-reduce:animate-none" />}
                </For>
              </div>
            </Match>
            <Match when={!reader.failed && reader.section}>
              {(section) => (
                <Show when={textKey()} keyed>
                  {(_shown) => (
                    <SectionText
                      section={section()}
                      initialParagraph={reader.initialParagraph}
                      onParagraphReached={reader.onParagraphReached}
                      onView={reader.onView}
                      statusOf={reader.statusOf}
                      selectedToken={reader.selectedWord ? reader.selectedToken : null}
                      onSelectToken={reader.selectToken}
                      spokenPhrase={reader.spokenPhrase}
                      passage={reader.passage}
                      passageActions={{
                        get translationShown() {
                          return reader.translationShown;
                        },
                        onTranslate: reader.translatePassage,
                        onListen: reader.listenToPassage,
                        onCopy: reader.copyPassage,
                      }}
                      onHoldText={reader.holdText}
                      onSelectPassage={reader.selectPassage}
                      onTapText={reader.tapText}
                      drawerOpen={
                        isMobile() && (reader.selectedWord !== null || reader.translationShown)
                      }
                      footer={
                        <SectionNav
                          position={section().position}
                          count={reader.titles.length}
                          onGo={reader.goToSection}
                        />
                      }
                    />
                  )}
                </Show>
              )}
            </Match>
          </Switch>
        </div>

        <Show when={!isMobile()}>
          <aside class="-m-1 w-80 shrink-0 overflow-y-auto p-1 scroll-fade">
            <WordPanel {...wordPanel} />
          </aside>
        </Show>
      </div>

      <Show when={isMobile()}>
        <WordDrawer {...wordPanel} onClose={reader.deselectWord} />
      </Show>
    </>
  );
}

function SectionNav(props: { position: number; count: number; onGo: (position: number) => void }) {
  const m = useMessages();
  return (
    <div class="mx-auto flex w-full max-w-2xl justify-between gap-3 py-8">
      <Button
        variant="outline"
        disabled={props.position === 0}
        onClick={() => props.onGo(props.position - 1)}
      >
        <Icon icon={ChevronLeft} data-icon="inline-start" />
        {m.reader.previousSection}
      </Button>
      <Button
        variant="outline"
        disabled={props.position >= props.count - 1}
        onClick={() => props.onGo(props.position + 1)}
      >
        {m.reader.nextSection}
        <Icon icon={ChevronRight} data-icon="inline-end" />
      </Button>
    </div>
  );
}

export default ReaderManager;
