import { useState } from "react";

/**
 * Words answered on a swipe deck: each is hidden until the refetched cards no
 * longer hold it, and its snapshot is kept so the answer can be undone.
 */
export function useAnswerHistory<Snapshot>() {
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const [undoStack, setUndoStack] = useState<Snapshot[]>([]);

  return {
    pending,
    hide: (word: string) => setPending((words) => new Set(words).add(word)),
    show: (word: string) =>
      setPending((words) => {
        const next = new Set(words);
        next.delete(word);
        return next;
      }),
    lastAnswer: undoStack.at(-1) ?? null,
    remember: (snapshot: Snapshot) => setUndoStack((stack) => [...stack, snapshot]),
    forget: (snapshot: Snapshot) =>
      setUndoStack((stack) => stack.filter((entry) => entry !== snapshot)),
  };
}
