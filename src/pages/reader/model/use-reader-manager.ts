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
  documentsQuery,
  sectionQuery,
  sectionsQuery,
  wordCardQuery,
  wordStatusesQuery,
} from "@/shared/api/queries.ts";
import { scriptAtom } from "@/shared/config/preferences.ts";
import { useMessages } from "@/shared/i18n/messages.ts";
import { actionToasts } from "@/shared/lib/toast.ts";
import { useKeyBindings } from "@/shared/lib/use-key-bindings.ts";
import { useQueryErrorToast } from "@/shared/lib/use-query-error-toast.ts";
import { useReadAloud } from "@/pages/reader/model/use-read-aloud.ts";

const readerToast = actionToasts("reader-action");

/** How long scrolling must pause before the reading position is saved. */
const SAVE_POSITION_MS = 800;

/** A word's colour in the text; null while statuses load. */
export type ReaderWordStatus = WordStatus | "unseen" | null;

/** A token in the section: where reading aloud starts. */
interface TokenPosition {
  paragraph: number;
  token: number;
}

const NO_PHRASES: SpokenPhrase[] = [];

export function useReaderManager(documentId: number) {
  const queryClient = useQueryClient();
  const m = useMessages();
  const script = useSelector(scriptAtom);

  const documents = useQuery(documentsQuery());
  const document = documents.data?.find((entry) => entry.id === documentId);
  const titles = useQuery(sectionsQuery(documentId, script));

  const [chosenSection, setChosenSection] = useState<number | null>(null);
  const position = chosenSection ?? document?.readingSection ?? null;
  const section = useQuery(sectionQuery(documentId, position, script));
  useQueryErrorToast(section.error ? m.reader.loadFailed : null, "reader-section");

  const words = useMemo(() => distinctWords(section.data), [section.data]);
  const statusesOptions = wordStatusesQuery(documentId, position, section.isSuccess ? words : null);
  const statuses = useQuery(statusesOptions);
  const statusOf = (word: string): ReaderWordStatus =>
    statuses.data ? (statuses.data[word] ?? "unseen") : null;
  const newWords = statuses.data ? words.filter((word) => !statuses.data[word]) : [];

  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [cursor, setCursor] = useState<TokenPosition | null>(null);
  const firstVisibleParagraph = useRef(0);
  const readAloud = useReadAloud(section.data?.phrases ?? NO_PHRASES);
  const wordCard = useQuery(wordCardQuery(selectedWord, script));

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

  const markNewKnownMutation = useMutation({
    mutationFn: commands.markWordsKnown,
    meta: { changesStudyData: true },
    onSuccess: (added) => readerToast.success(m.reader.markedKnown(added)),
    onError: (error) => readerToast.error(commandErrorMessage(error, m.reader.markFailed)),
  });
  const [confirmingMarkNewKnown, setConfirmingMarkNewKnown] = useState(false);

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
  const goToSection = (next: number) => {
    if (next < 0 || next >= sectionCount || next === position) return;
    positionSaver.cancel();
    readAloud.stop();
    setChosenSection(next);
    setSelectedWord(null);
    setCursor(null);
    void rememberPosition(next, 0);
  };

  const selectToken = (word: string, position: TokenPosition) => {
    setSelectedWord(word);
    setCursor(position);
    // A paused reading restarts from the new cursor instead of resuming.
    if (readAloud.status === "paused") readAloud.stop();
  };

  const toggleReadAloud = () => {
    if (readAloud.status === "playing") return readAloud.pause();
    if (readAloud.status === "paused") return readAloud.resume();
    const phrases = section.data?.phrases ?? [];
    const from = phraseAt(
      phrases,
      cursor ?? { paragraph: firstVisibleParagraph.current, token: 0 }
    );
    if (from !== -1) void readAloud.play(from);
  };

  useKeyBindings({
    Escape: () => {
      setSelectedWord(null);
      setCursor(null);
    },
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
    onParagraphReached: (paragraph: number) => {
      firstVisibleParagraph.current = paragraph;
      if (position !== null) positionSaver.maybeExecute(position, paragraph);
    },
    statusOf,
    selectedWord,
    selectToken,
    readAloudStatus: readAloud.status,
    readAloudLoading: readAloud.loading,
    spokenPhrase: readAloud.phrase,
    toggleReadAloud,
    stopReadAloud: readAloud.stop,
    wordCard: wordCard.data,
    wordCardLoading: wordCard.isLoading,
    wordCardFailed: wordCard.isError,
    setStatus: (word: string, status: WordStatus) => statusMutation.mutate({ word, status }),
    newWordCount: newWords.length,
    confirmingMarkNewKnown,
    askToMarkNewKnown: () => setConfirmingMarkNewKnown(true),
    cancelMarkNewKnown: () => setConfirmingMarkNewKnown(false),
    markNewKnown: () =>
      markNewKnownMutation.mutate(newWords, {
        onSettled: () => setConfirmingMarkNewKnown(false),
      }),
    markingNewKnown: markNewKnownMutation.isPending,
  };
}

/** The phrase holding `position`, or the first one after it. */
function phraseAt(phrases: SpokenPhrase[], { paragraph, token }: TokenPosition) {
  return phrases.findIndex(
    (phrase) =>
      phrase.paragraph > paragraph || (phrase.paragraph === paragraph && phrase.end > token)
  );
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
