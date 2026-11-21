import { createRoot, flush } from "solid-js";
import { expect, test } from "vitest";
import { useAnswerHistory } from "@/shared/lib/use-answer-history.ts";

/** The hook under an owner of its own, as a component would hold it. */
function mountHook<Snapshot>() {
  return createRoot(() => useAnswerHistory<Snapshot>());
}

test("hides answered words until shown again", () => {
  const history = mountHook<string>();

  history.hide("学习");
  history.hide("知道");
  history.show("学习");
  flush();

  expect([...history.pending]).toEqual(["知道"]);
});

test("undoes the latest answer first", () => {
  const history = mountHook<{ word: string }>();
  const first = { word: "学习" };
  const second = { word: "知道" };

  expect(history.lastAnswer).toBeNull();
  history.remember(first);
  history.remember(second);
  flush();
  expect(history.lastAnswer).toBe(second);

  history.forget(second);
  flush();
  expect(history.lastAnswer).toBe(first);
});
