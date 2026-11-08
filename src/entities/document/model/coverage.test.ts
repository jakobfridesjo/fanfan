import { describe, expect, it } from "vitest";
import { makeDocument } from "@/shared/test/fixtures.ts";
import { coverageOf, formatShare } from "@/entities/document/model/coverage.ts";

describe("coverageOf", () => {
  it("is the share of the document's tokens per status", () => {
    const document = makeDocument({ totalTokens: 200, knownTokens: 150, learningTokens: 20 });
    expect(coverageOf(document)).toEqual({ known: 0.75, learning: 0.1 });
  });

  it("is empty for a document without tokens", () => {
    const document = makeDocument({ totalTokens: 0, knownTokens: 0, learningTokens: 0 });
    expect(coverageOf(document)).toEqual({ known: 0, learning: 0 });
  });
});

describe("formatShare", () => {
  it("rounds down so an unfinished share never shows 100%", () => {
    expect(formatShare(0.996)).toBe("99%");
    expect(formatShare(1)).toBe("100%");
    expect(formatShare(0)).toBe("0%");
  });
});
