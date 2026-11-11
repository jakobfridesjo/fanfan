import { describe, expect, it } from "vitest";
import * as z from "zod/mini";
import { persistedJson, persistedString, type ValueStorage } from "@/shared/lib/persisted-value.ts";
import { createFakeStorage } from "@/shared/test/fake-storage.ts";

const NameSchema = z.object({ name: z.string() });

function jsonValue() {
  return persistedJson<{ name: string }>({
    key: "k",
    schema: NameSchema,
    fallback: { name: "fallback" },
  });
}

describe("persistedJson", () => {
  it("round-trips a value", () => {
    const storage = createFakeStorage();
    const value = jsonValue();

    value.save({ name: "stored" }, storage);

    expect(value.load(storage)).toEqual({ name: "stored" });
  });

  it("falls back when the key is absent, storage is unavailable, or the payload is invalid", () => {
    const value = jsonValue();

    expect(value.load(createFakeStorage())).toEqual({ name: "fallback" });
    expect(value.load(null)).toEqual({ name: "fallback" });
    expect(value.load(createFakeStorage({ k: "not json" }))).toEqual({ name: "fallback" });
    expect(value.load(createFakeStorage({ k: '{"name":42}' }))).toEqual({ name: "fallback" });
  });

  it("swallows a storage that throws on every operation", () => {
    const boom = () => {
      throw new Error("quota");
    };
    const hostile: ValueStorage = { getItem: boom, setItem: boom };
    const value = jsonValue();

    expect(value.load(hostile)).toEqual({ name: "fallback" });
    expect(() => value.save({ name: "stored" }, hostile)).not.toThrow();
  });
});

describe("persistedString", () => {
  it("stores an enum as a bare string, not JSON", () => {
    const storage = createFakeStorage();
    const theme = persistedString<"light" | "dark">({
      key: "theme",
      schema: z.enum(["light", "dark"]),
      fallback: "light",
    });

    theme.save("dark", storage);

    expect(storage.getItem("theme")).toBe("dark");
    expect(theme.load(storage)).toBe("dark");
  });

  it("falls back on a value outside the schema", () => {
    const theme = persistedString<"light" | "dark">({
      key: "theme",
      schema: z.enum(["light", "dark"]),
      fallback: "light",
    });

    expect(theme.load(createFakeStorage({ theme: "sepia" }))).toBe("light");
  });
});
