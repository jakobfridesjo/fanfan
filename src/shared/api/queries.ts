import { queryOptions, type QueryClient } from "@tanstack/react-query";
import { commands } from "@/shared/api/commands.ts";
import type { Script } from "@/shared/config/preferences.ts";

/** Cards fetched per deck or review batch; the rest load as these are used up. */
export const CARD_BATCH = 30;

export const queryKeys = {
  documents: ["documents"] as const,
  folders: ["folders"] as const,
  cover: (documentId: number) => ["cover", documentId] as const,
  deck: (documentId: number, script: Script) => ["deck", documentId, script] as const,
  sections: (documentId: number, script: Script) => ["sections", documentId, script] as const,
  section: (documentId: number, position: number, script: Script) =>
    ["section", documentId, position, script] as const,
  wordStatuses: (documentId: number, position: number) =>
    ["word-statuses", documentId, position] as const,
  wordCard: (word: string, script: Script) => ["word-card", word, script] as const,
  reviewQueue: (script: Script) => ["review-queue", script] as const,
  wordCounts: ["word-counts"] as const,
  statistics: (days: number) => ["statistics", days] as const,
  speech: (text: string) => ["speech", text] as const,
};

export const documentsQuery = () =>
  queryOptions({ queryKey: queryKeys.documents, queryFn: commands.listDocuments });

export const foldersQuery = () =>
  queryOptions({ queryKey: queryKeys.folders, queryFn: commands.listFolders });

/** A book's cover never changes; a deleted book's id is never reused while it is cached. */
export const coverQuery = (documentId: number) =>
  queryOptions({
    queryKey: queryKeys.cover(documentId),
    queryFn: () => commands.getCover(documentId),
    staleTime: Number.POSITIVE_INFINITY,
  });

export const deckQuery = (documentId: number, script: Script) =>
  queryOptions({
    queryKey: queryKeys.deck(documentId, script),
    queryFn: () => commands.getDeck(documentId, CARD_BATCH, script),
  });

/** A book's text never changes, so neither do its sections. */
export const sectionsQuery = (documentId: number, script: Script) =>
  queryOptions({
    queryKey: queryKeys.sections(documentId, script),
    queryFn: () => commands.listSections(documentId, script),
    staleTime: Number.POSITIVE_INFINITY,
  });

export const sectionQuery = (documentId: number, position: number, script: Script) =>
  queryOptions({
    queryKey: queryKeys.section(documentId, position, script),
    queryFn: () => commands.getSection(documentId, position, script),
    staleTime: Number.POSITIVE_INFINITY,
  });

/** `words` are the section's distinct words; the key leaves them out, since a section's words never change. */
export const wordStatusesQuery = (documentId: number, position: number, words: string[]) =>
  queryOptions({
    queryKey: queryKeys.wordStatuses(documentId, position),
    queryFn: () => commands.getWordStatuses(words),
  });

export const wordCardQuery = (word: string, script: Script) =>
  queryOptions({
    queryKey: queryKeys.wordCard(word, script),
    queryFn: () => commands.getWordCard(word, script),
  });

export const reviewQueueQuery = (script: Script) =>
  queryOptions({
    queryKey: queryKeys.reviewQueue(script),
    queryFn: () => commands.getReviewQueue(CARD_BATCH, script),
    // Cards come due on their own; a minute late is soon enough.
    refetchInterval: 60_000,
  });

export const wordCountsQuery = () =>
  queryOptions({ queryKey: queryKeys.wordCounts, queryFn: commands.getWordCounts });

export const statisticsQuery = (days: number) =>
  queryOptions({
    queryKey: queryKeys.statistics(days),
    queryFn: () => commands.getStatistics(days),
  });

/** Spoken text never changes, so it is synthesized once per session. */
export const speechQuery = (text: string) =>
  queryOptions({
    queryKey: queryKeys.speech(text),
    queryFn: () => commands.speak(text),
    staleTime: Number.POSITIVE_INFINITY,
  });

/** Queries whose results no word status changes. */
const UNCHANGING: ReadonlySet<string> = new Set(["cover", "speech", "sections", "section"]);

/**
 * A word's status feeds every document's coverage, every deck, the review
 * queue, the counts and the reader's colours, so a change refreshes all of them.
 */
export function invalidateStudyData(queryClient: QueryClient) {
  return queryClient.invalidateQueries({
    predicate: (query) => !UNCHANGING.has(String(query.queryKey[0])),
  });
}
