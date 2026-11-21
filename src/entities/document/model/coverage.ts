import type { DocumentSummary } from "@/shared/api/commands.ts";

export interface Coverage {
  /** Share of the document's word tokens, 0–1. */
  known: number;
  learning: number;
}

export function coverageOf(document: DocumentSummary): Coverage {
  if (document.totalTokens === 0) return { known: 0, learning: 0 };
  return {
    known: document.knownTokens / document.totalTokens,
    learning: document.learningTokens / document.totalTokens,
  };
}

/** Rounded down, so 99.6% never reads as a finished 100%. */
export function formatShare(share: number): string {
  return `${Math.floor(share * 100)}%`;
}
