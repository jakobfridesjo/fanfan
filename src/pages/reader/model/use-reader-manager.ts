import { useMemo, useRef, useState } from "react";
import { noop, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDebouncer } from "@tanstack/react-pacer";
import { useSelector } from "@tanstack/react-store";
import {
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
  documentsQuery,
  modelsQuery,
  sectionQuery,
  sectionsQuery,
  translationQuery,
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
  download: ModelDownload | undefined;
  onDownload: () => void;
  onCancel: () => void;
}

export function useReaderManager(documentId: number) {
  const queryClient = useQueryClient();
  const m = useMessages();
  const script = useSelector(scriptAtom);
  const notation = useSelector(readerNotationAtom);

  const documents = useQuery(documentsQuery());
  const document = documents.data?.find((entry) => entry.id === documentId);
  const titles = useQuery(sectionsQuery(documentId, script));

  const [chosenSection, setChosenSection] = useState<number | null>(null);
  const position = chosenSection ?? document?.readingSection ?? null;
  const section = useQuery(sectionQuery(documentId, position, script, notation));
  useQueryErrorToast(section.error ? m.reader.loadFailed : null, "reader-section");

  const words = useMemo(() => distinctWords(section.data), [section.data]);
  const statusesOptions = wordStatusesQuery(documentId, position, section.isSuccess ? words : null);
  const statuses = useQuery(statusesOptions);
  const statusOf = (word: string): ReaderWordStatus =>
    statuses.data ? (statuses.data[word] ?? "unseen") : null;

  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [cursor, setCursor] = useState<TokenPosition | null>(null);
  const view = useRef<TextView | null>(null);
  /** Where read-aloud was stopped, to carry on from while that text is still on screen. */
  const [stoppedAt, setStoppedAt] = useState<TokenPosition | null>(null);
  const phrases = section.data?.phrases ?? NO_PHRASES;
  const readAloud = useReadAloud();
  const wordCard = useQuery(wordCardQuery(selectedWord, script));

  const [passage, setPassage] = useState<Passage | null>(null);
  /** Whether the panel shows the passage's translation; until asked, only its toolbar shows. */
  const [translationShown, setTranslationShown] = useState(false);
  const passageText = passage && section.data ? textOf(section.data, passage) : null;
  const models = useQuery(modelsQuery());
  const translatorDownload = useSelector(modelDownloadsAtom).translator;
  // While the list of models is unknown, translating may still work.
  const translatorReady =
    models.data?.find((entry) => entry.model === "translator")?.downloaded ?? true;
  const translation = useQuery({
    ...translationQuery(passageText ?? ""),
    enabled: translationShown && passageText !== null && translatorReady,
  });

  const statusMutation = useMutation({
    mutationFn: ({ word, status }: { word: string; status: WordStatus }) =>
      commands.setWordStatus(word, status),
    meta: { changesStudyData: true },
    onMutate: ({ word, status }) =>
      queryClient.setQueryData(statusesOptions.queryKey, (previous) => ({
        ...previous,
        [word]: status,
      })),
    onError: (error) => readerToast.error(commandErrorMessage(error, m.reader.saveFailed)),
  });

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
  const positionSaver = useDebouncer(rememberPosition, { wait: SAVE_POSITION_MS });

  const sectionCount = titles.data?.length ?? 0;
  const showSection = (next: number) => {
    positionSaver.cancel();
    setChosenSection(next);
    setSelectedWord(null);
    setCursor(null);
    setPassage(null);
    setTranslationShown(false);
    setStoppedAt(null);
    void rememberPosition(next, 0);
  };

  const goToSection = (next: number) => {
    if (next < 0 || next >= sectionCount || next === position) return;
    readAloud.stop();
    showSection(next);
  };

  /** Reading on from section `from` into the next one, and so to the end of the book. */
  const sectionAfter = (from: number) => async (): Promise<Reading | null> => {
    const next = from + 1;
    if (next >= sectionCount) return null;
    const data = await queryClient.query(sectionQuery(documentId, next, script, notation));
    return { phrases: data.phrases, begin: () => showSection(next), next: sectionAfter(next) };
  };

  const selectToken = (word: string, position: TokenPosition) => {
    setSelectedWord(word);
    setCursor(position);
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

  /** A hold that may start a selection: the text must not scroll under the finger. */
  const holdText = () => {
    if (readAloud.status === "playing") readAloud.pause();
  };

  /** Selects a dragged-over stretch in place of a word, with a toolbar of what to do with it. */
  const selectPassage = (anchor: TokenPosition, focus: TokenPosition) => {
    const [from, to] = compare(anchor, focus) <= 0 ? [anchor, focus] : [focus, anchor];
    setSelectedWord(null);
    setCursor(from);
    setPassage({ from, to });
    setTranslationShown(false);
    if (readAloud.status === "paused") readAloud.stop();
  };

  /** A tap on the text away from any word drops a passage nobody has opened yet. */
  const tapText = () => {
    if (!translationShown) clearPassage();
  };

  /** Opens the translation, first asking to download the translator when it is missing. */
  const translatePassage = () => {
    const show = () => setTranslationShown(true);
    void ensureModel(queryClient, "translator", { toast: false, onAccept: show }).then(
      (ready) => ready && show()
    );
  };

  const listenToPassage = () => {
    if (passage && section.data)
      void readAloud.play(0, { phrases: phrasesOf(section.data, passage) });
  };

  const copyPassage = () => {
    if (passageText === null) return;
    navigator.clipboard.writeText(passageText).then(
      () => readerToast.success(m.reader.copied),
      () => readerToast.error(m.reader.copyFailed)
    );
  };

  const toggleReadAloud = () => {
    if (readAloud.status === "playing") return readAloud.pause();
    if (readAloud.status === "paused") return readAloud.resume();
    if (position !== null)
      void readAloud.play(startingPhrase(), { phrases, next: sectionAfter(position) });
  };

  /** The tapped word, else where reading stopped if still on screen, else the first phrase in view. */
  const startingPhrase = () => {
    if (cursor) return phraseAt(phrases, cursor);
    if (stoppedAt && view.current?.shows(stoppedAt)) return phraseAt(phrases, stoppedAt);
    const first = view.current?.firstToken();
    if (!first) return 0;
    // The last phrase may have begun above the view: read it rather than skip the chapter's end.
    const from = phraseFrom(phrases, first);
    return from < phrases.length ? from : phraseAt(phrases, first);
  };

  const stopReadAloud = () => {
    const phrase = readAloud.phrase;
    setStoppedAt(phrase && { paragraph: phrase.paragraph, token: phrase.start });
    readAloud.stop();
  };

  useKeyBindings({
    Escape: deselectWord,
    " ": toggleReadAloud,
  });

  return {
    document,
    loading: documents.isLoading || section.isLoading,
    failed: documents.isError || section.isError || (documents.isSuccess && !document),
    titles: titles.data ?? [],
    position,
    section: section.data,
    initialParagraph: initialParagraph(document, position),
    goToSection,
    viewRef: view,
    onParagraphReached: (paragraph: number) => {
      if (position !== null) positionSaver.maybeExecute(position, paragraph);
    },
    statusOf,
    selectedWord,
    selectedToken: cursor,
    selectToken,
    deselectWord,
    readAloudStatus: readAloud.status,
    readAloudLoading: readAloud.loading,
    spokenPhrase: readAloud.phrase,
    toggleReadAloud,
    stopReadAloud,
    wordCard: wordCard.data,
    wordCardLoading: wordCard.isLoading,
    wordCardFailed: wordCard.isError,
    setStatus: (word: string, status: WordStatus) => statusMutation.mutate({ word, status }),
    passage,
    passageText,
    holdText,
    selectPassage,
    tapText,
    translationShown,
    translatePassage,
    listenToPassage,
    copyPassage,
    translation: translation.data,
    translationLoading: translation.isFetching,
    translationError: translation.isError
      ? commandErrorMessage(translation.error, m.reader.translationFailed)
      : null,
    missingTranslator: translatorReady
      ? null
      : ({
          download: translatorDownload,
          onDownload: () => void downloadModel(queryClient, "translator"),
          onCancel: () => void cancelModelDownload("translator"),
        } satisfies MissingTranslator),
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

function distinctWords(section: ReaderSection | undefined): string[] {
  const words = new Set<string>();
  for (const paragraph of section?.paragraphs ?? []) {
    for (const token of paragraph) if (token.word) words.add(token.word);
  }
  return [...words];
}

/** A book reopens where it was left; another section starts at its top. */
function initialParagraph(document: DocumentSummary | undefined, position: number | null) {
  return document && position === document.readingSection ? document.readingParagraph : 0;
}
