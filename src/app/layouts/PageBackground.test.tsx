import { describe, expect, it } from "vitest";
import { PageBackground } from "@/app/layouts/PageBackground.tsx";
import { BACKGROUNDS, backgroundAtom } from "@/shared/config/preferences.ts";
import { renderPage } from "@/shared/test/render.tsx";

describe("PageBackground", () => {
  it.each(BACKGROUNDS.filter((background) => background !== "plain"))(
    "draws the %s background",
    async (background) => {
      backgroundAtom.set(background);
      const { container } = await renderPage(<PageBackground />);
      expect(container.querySelector("[aria-hidden]")?.children.length).toBeGreaterThan(0);
    }
  );

  it("draws nothing for the plain background", async () => {
    backgroundAtom.set("plain");
    const { container } = await renderPage(<PageBackground />);
    expect(container.querySelector("[aria-hidden]")).toBeNull();
  });
});
