import { flush } from "solid-js";
import { describe, expect, it, vi } from "vitest";
import { createAtom } from "@/shared/lib/atom.ts";

describe("createAtom", () => {
  it("shows a write to `get` at once and to the signal once flushed", () => {
    const count = createAtom(1);

    count.set((current) => current + 1);

    expect(count.get()).toBe(2);
    flush();
    expect(count()).toBe(2);
  });

  it("tells subscribers of each new value until they stop", () => {
    const name = createAtom("a");
    const heard = vi.fn();
    const stop = name.subscribe(heard);

    name.set("b");
    name.set("b");
    stop();
    name.set("c");

    expect(heard.mock.calls).toEqual([["b"]]);
  });
});
