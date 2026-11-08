import {
  EmailSchema,
  HttpUrlSchema,
  NonEmptyTrimmedStringSchema,
  NullishTrimmedStringSchema,
} from "@/shared/lib/field-schemas.ts";
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

describe("NullishTrimmedStringSchema", () => {
  it("accepts both null and undefined", () => {
    expect(NullishTrimmedStringSchema.safeParse(null).success).toBe(true);
    expect(NullishTrimmedStringSchema.safeParse(undefined).success).toBe(true);
  });
});

describe("EmailSchema", () => {
  it("trims surrounding whitespace", () => {
    expect(EmailSchema.parse("  user@example.com  ")).toBe("user@example.com");
  });

  it.for(["", "not-an-email", "user@", "@example.com", "user @example.com"])(
    "rejects %j with 'Must be a valid email'",
    (value) => {
      const result = EmailSchema.safeParse(value);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Must be a valid email");
    }
  );

  it("rejects emails longer than 255 characters", () => {
    const long = `${"a".repeat(250)}@example.com`;
    expect(EmailSchema.safeParse(long).success).toBe(false);
  });
});

describe("HttpUrlSchema", () => {
  it.for(["http://example.com", "https://example.com/path"])("accepts %j", (value) => {
    expect(HttpUrlSchema.safeParse(value).success).toBe(true);
  });

  it.for(["not a url", "ftp://example.com"])("rejects %j", (value) => {
    expect(HttpUrlSchema.safeParse(value).success).toBe(false);
  });
});
