import { NonEmptyTrimmedStringSchema } from "@/shared/lib/field-schemas.ts";
import { describe, expect, it } from "vitest";

describe("NonEmptyTrimmedStringSchema", () => {
  it("trims surrounding whitespace", () => {
    expect(NonEmptyTrimmedStringSchema.parse("  hello  ")).toBe("hello");
  });

  it.for(["", "   "])("rejects empty/whitespace value %j with 'Required'", (value) => {
    const result = NonEmptyTrimmedStringSchema.safeParse(value);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Required");
  });
});
