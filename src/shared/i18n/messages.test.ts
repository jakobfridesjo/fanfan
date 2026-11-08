import { describe, expect, it } from "vitest";
import { en } from "@/shared/i18n/messages-en.ts";
import { sv } from "@/shared/i18n/messages-sv.ts";
import { zh } from "@/shared/i18n/messages-zh.ts";

type MessageTree = { [key: string]: unknown };

/** Every message as text, functions called with a count or name of 2. */
function render(tree: MessageTree, path = ""): Record<string, string> {
  return Object.fromEntries(
    Object.entries(tree).flatMap(([key, value]) => {
      const name = path ? `${path}.${key}` : key;
      if (typeof value === "function") {
        const args = Array.from({ length: value.length }, () => 2);
        return [[name, String((value as (...args: number[]) => unknown)(...args))]];
      }
      if (typeof value === "object" && value !== null) {
        return Object.entries(render(value as MessageTree, name));
      }
      return [[name, String(value)]];
    })
  );
}

describe("messages", () => {
  const english = render(en);

  it.each([
    ["sv", sv],
    ["zh", zh],
  ])("%s translates every English message", (_language, messages) => {
    const translated = render(messages);
    expect(Object.keys(translated)).toEqual(Object.keys(english));
    for (const text of Object.values(translated)) expect(text.trim()).not.toBe("");
  });
});
