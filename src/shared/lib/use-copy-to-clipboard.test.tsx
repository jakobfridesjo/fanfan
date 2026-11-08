import { renderHook } from "vitest-browser-react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCopyToClipboard } from "@/shared/lib/use-copy-to-clipboard.ts";
function stubClipboard(writeText: (text: string) => Promise<void>) {
  const write = vi.fn(writeText);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: write },
  });
  return write;
}
function removeClipboard() {
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
}
describe("useCopyToClipboard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    removeClipboard();
  });
  it("writes the text and flags success until the reset elapses", async () => {
    const writeText = stubClipboard(() => Promise.resolve());
    const { result, act } = await renderHook(() => useCopyToClipboard(2000));
    expect(result.current.copied).toBe(false);
    await act(async () => {
      await expect(result.current.copy("hello")).resolves.toBe(true);
    });
    expect(writeText).toHaveBeenCalledWith("hello");
    expect(result.current.copied).toBe(true);
    await act(() => {
      vi.advanceTimersByTime(1999);
    });
    expect(result.current.copied).toBe(true);
    await act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.copied).toBe(false);
  });
  it("restarts the reset window on a second copy", async () => {
    stubClipboard(() => Promise.resolve());
    const { result, act } = await renderHook(() => useCopyToClipboard(2000));
    await act(async () => {
      await result.current.copy("first");
    });
    await act(() => {
      vi.advanceTimersByTime(1500);
    });
    await act(async () => {
      await result.current.copy("second");
    });
    await act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(result.current.copied).toBe(true);
    await act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current.copied).toBe(false);
  });
  it("reports failure without flagging success when the write rejects", async () => {
    stubClipboard(() => Promise.reject(new Error("denied")));
    const { result, act } = await renderHook(() => useCopyToClipboard());
    await act(async () => {
      await expect(result.current.copy("hello")).resolves.toBe(false);
    });
    expect(result.current.copied).toBe(false);
  });
  it("reports failure when there is no clipboard at all", async () => {
    removeClipboard();
    const { result, act } = await renderHook(() => useCopyToClipboard());
    await act(async () => {
      await expect(result.current.copy("hello")).resolves.toBe(false);
    });
    expect(result.current.copied).toBe(false);
  });
  it("does not reset after unmount", async () => {
    stubClipboard(() => Promise.resolve());
    const { result, unmount, act } = await renderHook(() => useCopyToClipboard(2000));
    await act(async () => {
      await result.current.copy("hello");
    });
    await unmount();
    expect(() => vi.advanceTimersByTime(2000)).not.toThrow();
    expect(vi.getTimerCount()).toBe(0);
  });
});
