import { createRoot } from "solid-js";
import { page } from "vitest/browser";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useIsMobile } from "@/shared/lib/use-mobile.ts";

const roots: (() => void)[] = [];

/** The hook under an owner of its own, as a component would hold it. */
function mountHook() {
  return createRoot((dispose) => {
    roots.push(dispose);
    return { isMobile: useIsMobile(), unmount: dispose };
  });
}

afterEach(async () => {
  roots.splice(0).forEach((dispose) => dispose());
  await page.viewport(1440, 900);
});

describe("useIsMobile", () => {
  it("resolves the breakpoint at once, before any event", async () => {
    await page.viewport(767, 900);
    expect(mountHook().isMobile()).toBe(true);
  });

  it("reports desktop above the breakpoint", async () => {
    await page.viewport(768, 900);
    expect(mountHook().isMobile()).toBe(false);
  });

  it("follows a viewport change", async () => {
    const { isMobile } = mountHook();
    expect(isMobile()).toBe(false);
    await page.viewport(767, 900);
    await expect.poll(() => isMobile()).toBe(true);
  });

  it("stops listening once unmounted", () => {
    const removeListener = vi.spyOn(MediaQueryList.prototype, "removeEventListener");
    mountHook().unmount();
    expect(removeListener).toHaveBeenCalledWith("change", expect.any(Function));
  });

  it("assumes desktop where matchMedia does not exist", () => {
    vi.stubGlobal("matchMedia", undefined);
    expect(mountHook().isMobile()).toBe(false);
  });
});
