import { renderHook } from "vitest-browser-react";
import { page } from "vitest/browser";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useIsMobile } from "@/shared/lib/use-mobile.ts";

afterEach(async () => {
  await page.viewport(1440, 900);
});

describe("useIsMobile", () => {
  it("resolves the breakpoint on the first render, before any event", async () => {
    await page.viewport(767, 900);
    const { result } = await renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it("reports desktop above the breakpoint", async () => {
    await page.viewport(768, 900);
    const { result } = await renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it("follows a viewport change", async () => {
    const { result } = await renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
    await page.viewport(767, 900);
    await expect.poll(() => result.current).toBe(true);
  });

  it("stops listening once unmounted", async () => {
    const removeListener = vi.spyOn(MediaQueryList.prototype, "removeEventListener");
    const { unmount } = await renderHook(() => useIsMobile());
    await unmount();
    expect(removeListener).toHaveBeenCalledWith("change", expect.any(Function));
  });

  it("assumes desktop where matchMedia does not exist", async () => {
    vi.stubGlobal("matchMedia", undefined);
    const { result } = await renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });
});
