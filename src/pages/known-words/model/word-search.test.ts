import { describe, expect, it } from "vitest";
import { makeWordEntry } from "@/shared/test/fixtures.ts";
import { matchesWordSearch } from "@/pages/known-words/model/word-search.ts";

const nihao = makeWordEntry("你好", {
  displayWord: "你好",
  readings: [
    { pinyin: "nǐ hǎo", zhuyin: "ㄋㄧˇ ㄏㄠˇ", definitions: ["Hello!", "Hi!"], properNoun: false },
  ],
});
const xuexi = makeWordEntry("学习", { displayWord: "學習" });

describe("matchesWordSearch", () => {
  it("finds a word by its characters in either script", () => {
    expect(matchesWordSearch(nihao, "你")).toBe(true);
    expect(matchesWordSearch(xuexi, "學")).toBe(true);
    expect(matchesWordSearch(xuexi, "学")).toBe(true);
  });

  it("finds pinyin with or without tone marks and spaces", () => {
    for (const query of ["nǐ hǎo", "ni hao", "nihao", "NIHAO", "  hao "]) {
      expect(matchesWordSearch(nihao, query)).toBe(true);
    }
    expect(matchesWordSearch(nihao, "xue")).toBe(false);
  });

  it("finds zhuyin with or without tone marks", () => {
    for (const query of ["ㄋㄧˇ ㄏㄠˇ", "ㄋㄧ", "ㄋㄧㄏㄠ"]) {
      expect(matchesWordSearch(nihao, query)).toBe(true);
    }
    expect(matchesWordSearch(nihao, "ㄒㄩㄝ")).toBe(false);
  });

  it("finds a definition case-insensitively and matches everything when blank", () => {
    expect(matchesWordSearch(nihao, "hello")).toBe(true);
    expect(matchesWordSearch(nihao, "")).toBe(true);
    expect(matchesWordSearch(nihao, "goodbye")).toBe(false);
  });
});
