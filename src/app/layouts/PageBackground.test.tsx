import { afterEach, describe, expect, it, vi } from "vitest";
import { PageBackground } from "@/app/layouts/PageBackground.tsx";
import { BACKGROUNDS, backgroundAtom } from "@/shared/config/preferences.ts";
import { renderPage } from "@/shared/test/render.tsx";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PageBackground", () => {
  it.each(BACKGROUNDS.filter((background) => background !== "plain"))(
    "draws the %s background with shaders that compile",
    (background) => {
      const consoleError = vi.spyOn(console, "error");
      backgroundAtom.set(background);
      const { container } = renderPage(() => <PageBackground />);
      const canvas = container.querySelector("[aria-hidden] canvas");
      expect(canvas).toBeInstanceOf(HTMLCanvasElement);
      expect(consoleError).not.toHaveBeenCalledWith("[Background shader]", expect.anything());
    }
  );

  it("draws nothing for the plain background", () => {
    backgroundAtom.set("plain");
    const { container } = renderPage(() => <PageBackground />);
    expect(container.querySelector("[aria-hidden]")).toBeNull();
  });
});
