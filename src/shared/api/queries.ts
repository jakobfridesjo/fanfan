import { queryOptions, skipToken, type QueryClient } from "@tanstack/react-query";
import { commands } from "@/shared/api/commands.ts";
import type { ReaderNotation, Script, Speaker } from "@/shared/config/preferences.ts";

/** Cards fetched per deck or review batch; the rest load as these are used up. */
const CARD_BATCH = 30;

export const documentsQuery = () =>
  queryOptions({ queryKey: ["documents"], queryFn: commands.listDocuments });

export const foldersQuery = () =>
  queryOptions({ queryKey: ["folders"], queryFn: commands.listFolders });

/** A book's cover never changes; a deleted book's id is never reused while it is cached. */
export const coverQuery = (documentId: number) =>
  queryOptions({
    queryKey: ["cover", documentId],
    queryFn: () => commands.getCover(documentId),
    staleTime: "static",
  });

export const deckQuery = (documentId: number, script: Script) =>
  queryOptions({
    queryKey: ["deck", documentId, script],
    queryFn: () => commands.getDeck(documentId, CARD_BATCH, script),
  });

/** A book's text never changes, so neither do its sections. */
export const sectionsQuery = (documentId: number, script: Script) =>
  queryOptions({
    queryKey: ["sections", documentId, script],
    queryFn: () => commands.listSections(documentId, script),
    staleTime: "static",
  });

/** Skipped until the reading position is known. */
export const sectionQuery = (
  documentId: number,
  position: number | null,
  script: Script,
  notation: ReaderNotation
) =>
  queryOptions({
    queryKey: ["section", documentId, position, script, notation],
    queryFn:
      position === null
        ? skipToken
        : () => commands.getSection(documentId, position, script, notation),
    staleTime: "static",
  });

/**
 * `words` are the section's distinct words, or null while it loads; the key
 * leaves them out, since a section's words never change.
 */
export const wordStatusesQuery = (
  documentId: number,
  position: number | null,
  words: string[] | null
) =>
  queryOptions({
    queryKey: ["word-statuses", documentId, position],
    queryFn: words === null ? skipToken : () => commands.getWordStatuses(words),
  });

/** Skipped while no word is selected. */
export const wordCardQuery = (word: string | null, script: Script) =>
  queryOptions({
    queryKey: ["word-card", word, script],
    queryFn: word === null ? skipToken : () => commands.getWordCard(word, script),
  });

export const reviewQueueQuery = (script: Script) =>
  queryOptions({
    queryKey: ["review-queue", script],
    queryFn: () => commands.getReviewQueue(CARD_BATCH, script),
    // Cards come due on their own; a minute late is soon enough.
    refetchInterval: 60_000,
  });

export const wordListQuery = (script: Script) =>
  queryOptions({
    queryKey: ["word-list", script],
    queryFn: () => commands.listWords(script),
  });

/** Statistics for the calendar days `from` to `to` (`YYYY-MM-DD`), both included. */
export const statisticsQuery = (from: string, to: string) =>
  queryOptions({
    queryKey: ["statistics", from, to],
    queryFn: () => commands.getStatistics(from, to),
  });

/**
 * Spoken text never changes. Rust keeps every generated file; this cache only
 * spares the round trip for audio played again within the default `gcTime`.
 */
export const speechQuery = (text: string, speaker: Speaker) =>
  queryOptions({
    queryKey: ["speech", text, speaker],
    queryFn: () => commands.speak(text, speaker),
    staleTime: "static",
  });

/** Chinese text in English: the model gives the same translation every time. */
export const translationQuery = (text: string) =>
  queryOptions({
    queryKey: ["translation", text],
    queryFn: () => commands.translate(text),
    staleTime: "static",
  });

/** Which downloadable models are on this device. */
export const modelsQuery = () =>
  queryOptions({ queryKey: ["models"], queryFn: commands.listModels });

/**
 * A word's status feeds every document's coverage, every deck, the review
 * queue, the counts and the reader's colours, so a change refreshes all of
 * them. Static queries (text, covers, speech, translations) are never refetched.
 */
export function invalidateStudyData(queryClient: QueryClient) {
  return queryClient.invalidateQueries();
}
