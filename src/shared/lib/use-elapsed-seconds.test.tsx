import { renderHook } from "vitest-browser-react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useElapsedSeconds } from "@/shared/lib/use-elapsed-seconds.ts";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useElapsedSeconds", () => {
  it("counts whole seconds while active", async () => {
    const { result, act } = await renderHook(() => useElapsedSeconds(true));

    expect(result.current).toBe(0);

    await act(() => vi.advanceTimersByTime(2500));
    expect(result.current).toBe(2);
  });

  it("stays at zero while inactive", async () => {
    const { result, act } = await renderHook(() => useElapsedSeconds(false));

    await act(() => vi.advanceTimersByTime(3000));
    expect(result.current).toBe(0);
  });

  it("restarts from zero on each activation", async () => {
    const { result, rerender, act } = await renderHook(
      (props) => useElapsedSeconds(props!.active),
      { initialProps: { active: true } }
    );

    await act(() => vi.advanceTimersByTime(3000));
    expect(result.current).toBe(3);

    await rerender({ active: false });
    expect(result.current).toBe(0);

    await rerender({ active: true });
    expect(result.current).toBe(0);

    await act(() => vi.advanceTimersByTime(1000));
    expect(result.current).toBe(1);
  });
});
