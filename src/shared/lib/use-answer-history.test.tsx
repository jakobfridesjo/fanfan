import { expect, test } from "vitest";
import { renderHook } from "vitest-browser-react";
import { useAnswerHistory } from "@/shared/lib/use-answer-history.ts";

test("hides answered words until shown again", async () => {
  const { result, act } = await renderHook(() => useAnswerHistory<string>());

  await act(() => {
    result.current.hide("学习");
    result.current.hide("知道");
  });
  await act(() => result.current.show("学习"));

  expect([...result.current.pending]).toEqual(["知道"]);
});

test("undoes the latest answer first", async () => {
  const { result, act } = await renderHook(() => useAnswerHistory<{ word: string }>());
  const first = { word: "学习" };
  const second = { word: "知道" };

  expect(result.current.lastAnswer).toBeNull();
  await act(() => {
    result.current.remember(first);
    result.current.remember(second);
  });
  expect(result.current.lastAnswer).toBe(second);

  await act(() => result.current.forget(second));
  expect(result.current.lastAnswer).toBe(first);
});
