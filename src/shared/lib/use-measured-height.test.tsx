import { useMeasuredHeight } from "@/shared/lib/use-measured-height.ts";
import { page as screen } from "vitest/browser";
import { describe, expect, it } from "vitest";
import { renderPage } from "@/shared/test/render.tsx";

function Harness({ height }: { height: number }) {
  const { containerRef, height: measuredHeight } = useMeasuredHeight();
  return (
    <div ref={containerRef} style={{ height }}>
      <output aria-label="Measured height">{measuredHeight}</output>
    </div>
  );
}

describe("useMeasuredHeight", () => {
  it("tracks real Chromium layout changes and cleans up on unmount", async () => {
    const view = await renderPage(<Harness height={120} />);
    await expect
      .poll(() => screen.getByLabelText("Measured height").element().textContent)
      .toBe("120");

    await view.rerender(<Harness height={240} />);
    await expect
      .poll(() => screen.getByLabelText("Measured height").element().textContent)
      .toBe("240");
    await view.unmount();
  });
});
