import { renderHook } from "vitest-browser-react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useIdle } from "@/shared/lib/use-idle.ts";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useIdle", () => {
  it("turns idle after the quiet period and active again on input", async () => {
    const { result, act } = await renderHook(() => useIdle(1_000));
    expect(result.current).toBe(false);

    await act(() => vi.advanceTimersByTime(1_000));
    expect(result.current).toBe(true);

    await act(() => window.dispatchEvent(new Event("pointermove")));
    expect(result.current).toBe(false);

    await act(() => vi.advanceTimersByTime(999));
    expect(result.current).toBe(false);
    await act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe(true);
  });

  it("counts a tab becoming visible as input", async () => {
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    const { result, act } = await renderHook(() => useIdle(1_000));
    await act(() => vi.advanceTimersByTime(1_000));
    expect(result.current).toBe(true);

    await act(() => document.dispatchEvent(new Event("visibilitychange")));

    expect(result.current).toBe(false);
  });

  it("never reads as idle while disabled, and restarts when enabled", async () => {
    const { result, rerender, act } = await renderHook((props) => useIdle(1_000, props!.enabled), {
      initialProps: { enabled: false },
    });
    await act(() => vi.advanceTimersByTime(5_000));
    expect(result.current).toBe(false);

    await rerender({ enabled: true });
    expect(result.current).toBe(false);
    await act(() => vi.advanceTimersByTime(1_000));
    expect(result.current).toBe(true);

    await rerender({ enabled: false });
    expect(result.current).toBe(false);
  });
});
