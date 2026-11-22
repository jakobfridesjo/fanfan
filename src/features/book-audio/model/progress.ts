import type { PrepareProgress } from "@/shared/api/commands.ts";

/** Where a run's first report found the job, and when, to time the chapters after it. */
export interface Timing {
  section: number;
  fraction: number;
  at: number;
}

/** How much of the job's sections are done, from 0 to 1. */
export function fractionDone(progress: PrepareProgress) {
  if (progress.sectionsTotal === 0) return 1;
  const section = progress.phrasesTotal > 0 ? progress.phrasesDone / progress.phrasesTotal : 0;
  return (progress.sectionsDone + section) / progress.sectionsTotal;
}

/**
 * Milliseconds the job still needs, going by how fast it has gone since its first report; null until
 * it has finished a chapter in this run, since chapters skipped as prepared say nothing of its speed.
 */
export function timeLeft(
  progress: PrepareProgress | null,
  timing: Timing | null,
  reportedAt: number
): number | null {
  if (!progress || !timing || progress.section === timing.section) return null;
  const done = fractionDone(progress);
  const gained = done - timing.fraction;
  if (gained <= 0) return null;
  return ((reportedAt - timing.at) / gained) * (1 - done);
}
