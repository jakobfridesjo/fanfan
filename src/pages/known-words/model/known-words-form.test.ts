import { describe, expect, it } from "vitest";
import * as z from "zod/mini";
import { KnownWordsFormSchema } from "@/pages/known-words/model/known-words-form.ts";

describe("KnownWordsFormSchema", () => {
  it("accepts text with Chinese words and trims it", () => {
    expect(z.parse(KnownWordsFormSchema, { text: "  你好\nhello\t学习 " })).toEqual({
      text: "你好\nhello\t学习",
    });
  });

  it("rejects blank text and text without Chinese", () => {
    const issues = (text: string) =>
      z.safeParse(KnownWordsFormSchema, { text }).error?.issues.map((issue) => issue.message);

    expect(issues("   ")).toEqual(["Required", "Paste at least one Chinese word"]);
    expect(issues("hello, world")).toEqual(["Paste at least one Chinese word"]);
  });
});
