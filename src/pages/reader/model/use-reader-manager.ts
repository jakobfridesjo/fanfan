import { createMemo, createSignal, onCleanup, onFlush } from "solid-js";
import { noop, useMutation, useQueryClient } from "@tanstack/solid-query";
import { Debouncer } from "@tanstack/pacer";
import {
  type Bookmark,
  commandErrorMessage,
  commands,
  type DocumentSummary,
  type ReaderSection,
  type SpokenPhrase,
  type WordStatus,
} from "@/shared/api/commands.ts";
import {
  cancelModelDownload,
  downloadModel,
  ensureModel,
  modelDownloadsAtom,
  type ModelDownload,
} from "@/shared/api/model-downloads.ts";
import {
  bookmarksQuery,
  documentsQuery,
  modelsQuery,
  sectionQuery,
  sectionsQuery,
  translationQuery,
  useCommandQuery,
  wordCardQuery,
  wordStatusesQuery,
} from "@/shared/api/queries.ts";
import { readerNotationAtom, scriptAtom } from "@/shared/config/preferences.ts";
import { useMessages } from "@/shared/i18n/messages.ts";
import { actionToasts } from "@/shared/lib/toast.ts";
import { useKeyBindings } from "@/shared/lib/use-key-bindings.ts";
import { useQueryErrorToast } from "@/shared/lib/use-query-error-toast.ts";
import { type Reading, useReadAloud } from "@/pages/reader/model/use-read-aloud.ts";
import type { TextView } from "@/pages/reader/model/use-section-scroll.ts";

const readerToast = actionToasts("reader-action");

/** How long scrolling must pause before the reading position is saved. */
const SAVE_POSITION_MS = 800;

/** A word's colour in the text; null while statuses load. */
export type ReaderWordStatus = WordStatus | "unseen" | null;

/** A token in the section: where reading aloud starts. */
export interface TokenPosition {
  paragraph: number;
  token: number;
}

/** Tokens `from` to `to`, both included: the passage the panel translates. */
export interface Passage {
  from: TokenPosition;
  to: TokenPosition;
}

const NO_PHRASES: SpokenPhrase[] = [];

/** The translator while it is not on the device: its download, if one runs or failed. */
export interface MissingTranslator {
  readonly download: ModelDownload | undefined;
  onDownload: () => void;
  onCancel: () => void;
}

export function useReaderManager(documentId: number) {
  const queryClient = useQueryClient();
  const m = useMessages();

  const documents = useCommandQuery(() => documentsQuery());
  const document = () => documents.data?.find((entry) => entry.id === documentId);
  const titles = useCommandQuery(() => sectionsQuery(documentId, scriptAtom()));

  const [chosenSection, setChosenSection] = createSignal<number | null>(null);
  const position = createMemo(() => chosenSection() ?? document()?.readingSection ?? null);
  /** Where the chosen section's text opens. */
  const [startParagraph, setStartParagraph] = createSignal(0);
  const openingParagraph = () =>
    chosenSection() === null ? initialParagraph(document(), position()) : startParagraph();
  /** The first paragraph in view; null until the text reports it. */
  const [topParagraph, setTopParagraph] = createSignal<number | null>(null);
  const currentParagraph = () => topParagraph() ?? openingParagraph();
  /** Counts the jumps, so a jump within the shown section opens its text afresh. */
  const [visit, setVisit] = createSignal(0);
  const section = useCommandQuery(() =>
    sectionQuery(documentId, position(), scriptAtom(), readerNotationAtom())
  );
  useQueryErrorToast(() => (section.isError ? m.reader.loadFailed : null), "reader-section");

  const words = createMemo(() => (section.data ? distinctWords(section.data) : null));
  const statusesOptions = () => wordStatusesQuery(documentId, position(), words());
  const statuses = useCommandQuery(statusesOptions);
  /** Statuses being saved: solid-query holds what a mutation writes until it settles, so they show from here. */
  const [saving, setSaving] = createSignal<Record<string, WordStatus>>({});
  const statusOf = (word: string): ReaderWordStatus =>
    saving()[word] ?? (statuses.data ? (statuses.data[word] ?? "unseen") : null);

  const [selectedWord, setSelectedWord] = createSignal<string | null>(null);
  const [cursor, setCursor] = createSignal<TokenPosition | null>(null);
  let view: TextView | null = null;
  /** Where read-aloud was stopped, to carry on from while that text is still on screen. */
  const [stoppedAt, setStoppedAt] = createSignal<TokenPosition | null>(null);
  const phrases = () => section.data?.phrases ?? NO_PHRASES;
  const readAloud = useReadAloud();
  const wordCard = useCommandQuery(() => wordCardQuery(selectedWord(), scriptAtom()));

  const [passage, setPassage] = createSignal<Passage | null>(null);
  /** Whether the panel shows the passage's translation; until asked, only its toolbar shows. */
  const [translationShown, setTranslationShown] = createSignal(false);
  const passageText = createMemo(() => {
    const selected = passage();
    return selected && section.data ? textOf(section.data, selected) : null;
  });
  const models = useCommandQuery(() => modelsQuery());
  // While the list of models is unknown, translating may still work.
  const translatorReady = () =>
    models.data?.find((entry) => entry.model === "translator")?.downloaded ?? true;
  const translation = useCommandQuery(() => ({
    ...translationQuery(passageText() ?? ""),
    enabled: translationShown() && passageText() !== null && translatorReady(),
  }));

  const statusMutation = useMutation(() => ({
    mutationFn: ({ word, status }: { word: string; status: WordStatus }) =>
      commands.setWordStatus(word, status),
    meta: { changesStudyData: true as const },
    onMutate: ({ word, status }: { word: string; status: WordStatus }) =>
      onFlush(() => setSaving((words) => ({ ...words, [word]: status }))),
    onError: (error: Error) => readerToast.error(commandErrorMessage(error, m.reader.saveFailed)),
  }));

  const rememberPosition = (readingSection: number, readingParagraph: number) =>
    commands
      .setReadingPosition(documentId, readingSection, readingParagraph)
      .then(() =>
        queryClient.setQueryData(documentsQuery().queryKey, (previous) =>
          previous?.map((entry) =>
            entry.id === documentId ? { ...entry, readingSection, readingParagraph } : entry
          )
        )
      )
      .catch(noop);
  const positionSaver = new Debouncer(rememberPosition, { wait: SAVE_POSITION_MS });
  onCleanup(() => positionSaver.cancel());

  const sectionCount = () => titles.data?.length ?? 0;
  const showSection = (next: number, paragraph = 0) => {
    positionSaver.cancel();
    setChosenSection(next);
    setStartParagraph(paragraph);
    setTopParagraph(null);
    setVisit((count) => count + 1);
    setSelectedWord(null);
    setCursor(null);
    setPassage(null);
    setTranslationShown(false);
    setStoppedAt(null);
    void rememberPosition(next, paragraph);
  };

  const goToSection = (next: number) => {
    if (next < 0 || next >= sectionCount() || next === position()) return;
    readAloud.stop();
    showSection(next);
  };

  /** Reading on from section `from` into the next one, and so to the end of the book. */
  const sectionAfter = (from: number) => async (): Promise<Reading | null> => {
    const next = from + 1;
    if (next >= sectionCount()) return null;
    const data = await queryClient.query(
      sectionQuery(documentId, next, scriptAtom.get(), readerNotationAtom.get())
    );
    return { phrases: data.phrases, begin: () => showSection(next), next: sectionAfter(next) };
  };

  const bookmarks = useCommandQuery(() => bookmarksQuery(documentId, scriptAtom()));
  const bookmarkHere = createMemo(() => {
    const at = position();
    const paragraph = currentParagraph();
    return (
      bookmarks.data?.find((mark) => mark.section === at && mark.paragraph === paragraph) ?? null
    );
  });
  // In every script.
  const refreshBookmarks = () =>
    queryClient.invalidateQueries({ queryKey: ["bookmarks", documentId] });
  const addBookmark = useMutation(() => ({
    mutationFn: ({ section, paragraph }: { section: number; paragraph: number }) =>
      commands.addBookmark(documentId, section, paragraph),
    onSuccess: () => readerToast.success(m.reader.bookmarked),
    onError: (error: Error) =>
      readerToast.error(commandErrorMessage(error, m.reader.bookmarkFailed)),
    onSettled: refreshBookmarks,
  }));
  const deleteBookmark = useMutation(() => ({
    mutationFn: (bookmark: Bookmark) => commands.deleteBookmark(bookmark.id),
    onSuccess: (_result: null, bookmark: Bookmark) =>
      readerToast.success(m.reader.bookmarkRemoved, {
        action: {
          label: m.reader.undo,
          onClick: () =>
            void addBookmark.mutate({ section: bookmark.section, paragraph: bookmark.paragraph }),
        },
      }),
    onError: (error: Error) =>
      readerToast.error(commandErrorMessage(error, m.reader.bookmarkFailed)),
    onSettled: refreshBookmarks,
  }));

  /** Bookmarks the paragraph at the top of the view, or takes its bookmark away. */
  const toggleBookmark = () => {
    const existing = bookmarkHere();
    if (existing) return void deleteBookmark.mutate(existing);
    const at = position();
    if (at !== null) void addBookmark.mutate({ section: at, paragraph: currentParagraph() });
  };

  const goToBookmark = (bookmark: Bookmark) => {
    readAloud.stop();
    showSection(bookmark.section, bookmark.paragraph);
  };

  const selectToken = (word: string, at: TokenPosition) => {
    setSelectedWord(word);
    setCursor(at);
    setPassage(null);
    // A paused reading restarts from the new cursor instead of resuming.
    if (readAloud.status === "paused") readAloud.stop();
  };

  const clearPassage = () => {
    setPassage(null);
    setTranslationShown(false);
  };

  const deselectWord = () => {
    setSelectedWord(null);
    setCursor(null);
    clearPassage();
  };

  /** Whether the hold under way paused the reading, which then stays paused through its selection. */
  let pausedForHold = false;

  /** A hold that may start a selection: the text must not scroll under the finger. */
  const holdText = () => {
    pausedForHold = readAloud.status === "playing";
    if (pausedForHold) readAloud.pause();
  };

  /** Selects a dragged-over stretch in place of a word, with a toolbar of what to do with it. */
  const selectPassage = (anchor: TokenPosition, focus: TokenPosition) => {
    const [from, to] = compare(anchor, focus) <= 0 ? [anchor, focus] : [focus, anchor];
    setSelectedWord(null);
    setCursor(from);
    setPassage({ from, to });
    setTranslationShown(false);
    if (readAloud.status === "paused" && !pausedForHold) readAloud.stop();
  };

  /** A tap on the text away from any word drops a passage nobody has opened yet. */
  const tapText = () => {
    if (!translationShown()) clearPassage();
  };

  /** Opens the translation, first asking to download the translator when it is missing. */
  const translatePassage = () => {
    const show = () => setTranslationShown(true);
    void ensureModel(queryClient, "translator", { toast: false, onAccept: show }).then(
      (ready) => ready && show()
    );
  };

  const listenToPassage = () => {
    const selected = passage();
    if (selected && section.data)
      void readAloud.play(0, { phrases: phrasesOf(section.data, selected) });
  };

  const copyPassage = () => {
    const text = passageText();
    if (text === null) return;
    navigator.clipboard.writeText(text).then(
      () => readerToast.success(m.reader.copied),
      () => readerToast.error(m.reader.copyFailed)
    );
  };

  const toggleReadAloud = () => {
    if (readAloud.status === "playing") return readAloud.pause();
    if (readAloud.status === "paused") return readAloud.resume();
    const from = position();
    if (from !== null)
      void readAloud.play(startingPhrase(), { phrases: phrases(), next: sectionAfter(from) });
  };

  /** The tapped word, else where reading stopped if still on screen, else the first phrase in view. */
  const startingPhrase = () => {
    const list = phrases();
    const tapped = cursor();
    if (tapped) return phraseAt(list, tapped);
    const stopped = stoppedAt();
    if (stopped && view?.shows(stopped)) return phraseAt(list, stopped);
    const first = view?.firstToken();
    if (!first) return 0;
    // The last phrase may have begun above the view: read it rather than skip the chapter's end.
    const from = phraseFrom(list, first);
    return from < list.length ? from : phraseAt(list, first);
  };

  const stopReadAloud = () => {
    const phrase = readAloud.phrase;
    setStoppedAt(phrase && { paragraph: phrase.paragraph, token: phrase.start });
    readAloud.stop();
  };

  useKeyBindings(() => ({
    Escape: deselectWord,
    " ": toggleReadAloud,
  }));

  const missingTranslator: MissingTranslator = {
    get download() {
      return modelDownloadsAtom().translator;
    },
    onDownload: () => void downloadModel(queryClient, "translator"),
    onCancel: () => void cancelModelDownload("translator"),
  };

  return {
    get document() {
      return document();
    },
    get loading() {
      return documents.isLoading || section.isLoading;
    },
    get failed() {
      return documents.isError || section.isError || (documents.data !== undefined && !document());
    },
    get titles() {
      return titles.data ?? [];
    },
    get position() {
      return position();
    },
    get section() {
      return section.data;
    },
    get initialParagraph() {
      return openingParagraph();
    },
    /** Changes whenever the text must open afresh: another section, or a jump. */
    get textKey() {
      const shown = section.data?.position;
      return shown === undefined ? undefined : `${shown}:${visit()}`;
    },
    goToSection,
    onView: (shown: TextView | null) => {
      view = shown;
    },
    onParagraphReached: (paragraph: number) => {
      setTopParagraph(paragraph);
      const at = position();
      if (at !== null) positionSaver.maybeExecute(at, paragraph);
    },
    get bookmarks() {
      return bookmarks.data ?? [];
    },
    get bookmarked() {
      return bookmarkHere() !== null;
    },
    get bookmarkSaving() {
      return addBookmark.isPending || deleteBookmark.isPending;
    },
    toggleBookmark,
    goToBookmark,
    deleteBookmark: (bookmark: Bookmark) => void deleteBookmark.mutate(bookmark),
    statusOf,
    get selectedWord() {
      return selectedWord();
    },
    get selectedToken() {
      return cursor();
    },
    selectToken,
    deselectWord,
    get readAloudStatus() {
      return readAloud.status;
    },
    get readAloudLoading() {
      return readAloud.loading;
    },
    get spokenPhrase() {
      return readAloud.phrase;
    },
    toggleReadAloud,
    stopReadAloud,
    get wordCard() {
      return wordCard.data;
    },
    get wordCardLoading() {
      return wordCard.isLoading;
    },
    get wordCardFailed() {
      return wordCard.isError;
    },
    setStatus: (word: string, status: WordStatus) => void statusMutation.mutate({ word, status }),
    get passage() {
      return passage();
    },
    get passageText() {
      return passageText();
    },
    holdText,
    selectPassage,
    tapText,
    get translationShown() {
      return translationShown();
    },
    translatePassage,
    listenToPassage,
    copyPassage,
    get translation() {
      return translation.data;
    },
    get translationLoading() {
      return translation.isFetching;
    },
    get translationError() {
      return translation.isError
        ? commandErrorMessage(translation.error, m.reader.translationFailed)
        : null;
    },
    get missingTranslator() {
      return translatorReady() ? null : missingTranslator;
    },
  };
}

/** The phrase holding `position`, or the first one after it; past the last when none is. */
function phraseAt(phrases: SpokenPhrase[], { paragraph, token }: TokenPosition) {
  return indexOrEnd(
    phrases,
    (phrase) =>
      phrase.paragraph > paragraph || (phrase.paragraph === paragraph && phrase.end > token)
  );
}

/** The first phrase starting at `position` or after it; past the last when none is. */
function phraseFrom(phrases: SpokenPhrase[], { paragraph, token }: TokenPosition) {
  return indexOrEnd(
    phrases,
    (phrase) =>
      phrase.paragraph > paragraph || (phrase.paragraph === paragraph && phrase.start >= token)
  );
}

function indexOrEnd<T>(items: T[], matches: (item: T) => boolean) {
  const index = items.findIndex(matches);
  return index === -1 ? items.length : index;
}

/** Negative when `a` comes before `b` in the section, positive after. */
function compare(a: TokenPosition, b: TokenPosition) {
  return a.paragraph - b.paragraph || a.token - b.token;
}

/** The tokens of `passage`, in order with their positions. */
function* tokensOf(section: ReaderSection, { from, to }: Passage) {
  for (let paragraph = from.paragraph; paragraph <= to.paragraph; paragraph += 1) {
    const tokens = section.paragraphs[paragraph] ?? [];
    const first = paragraph === from.paragraph ? from.token : 0;
    const end = paragraph === to.paragraph ? to.token + 1 : tokens.length;
    yield* tokens.slice(first, end);
  }
}

/** `passage` as one phrase to speak for each paragraph it reaches into. */
function phrasesOf(section: ReaderSection, { from, to }: Passage): SpokenPhrase[] {
  const phrases: SpokenPhrase[] = [];
  for (let paragraph = from.paragraph; paragraph <= to.paragraph; paragraph += 1) {
    const tokens = section.paragraphs[paragraph] ?? [];
    const start = paragraph === from.paragraph ? from.token : 0;
    const end = paragraph === to.paragraph ? to.token + 1 : tokens.length;
    const text = textOf(section, {
      from: { paragraph, token: start },
      to: { paragraph, token: end - 1 },
    });
    if (/\p{Script=Han}/u.test(text)) phrases.push({ paragraph, start, end, text });
  }
  return phrases;
}

function textOf(section: ReaderSection, passage: Passage) {
  return [...tokensOf(section, passage)].map((token) => token.text).join("");
}

function distinctWords(section: ReaderSection): string[] {
  const words = new Set<string>();
  for (const paragraph of section.paragraphs) {
    for (const token of paragraph) if (token.word) words.add(token.word);
  }
  return [...words];
}

/** A book reopens where it was left; another section starts at its top. */
function initialParagraph(document: DocumentSummary | undefined, position: number | null) {
  return document && position === document.readingSection ? document.readingParagraph : 0;
}
