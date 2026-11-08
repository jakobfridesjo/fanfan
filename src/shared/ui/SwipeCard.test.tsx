import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { describe, expect, it, vi } from "vitest";
import { dragHorizontally as drag } from "@/shared/test/pointer.ts";
import { SwipeCard } from "@/shared/ui/SwipeCard.tsx";

async function renderCard(disabled = false) {
  const onSwipe = vi.fn();
  await render(
    <div className="w-96 p-20">
      <SwipeCard onSwipe={onSwipe} disabled={disabled}>
        <div className="h-40">学习</div>
      </SwipeCard>
    </div>
  );
  const card = page.getByText("学习").element().parentElement;
  if (!card) throw new Error("Card not rendered");
  return { onSwipe, card };
}

describe("SwipeCard", () => {
  it("answers right or left once dragged far enough", async () => {
    const { onSwipe, card } = await renderCard();

    await drag(card, 220, 12);
    await expect.poll(() => onSwipe.mock.calls).toEqual([["right"]]);
  });

  it("answers left for a drag to the left", async () => {
    const { onSwipe, card } = await renderCard();

    await drag(card, -220, 12);
    await expect.poll(() => onSwipe.mock.calls).toEqual([["left"]]);
  });

  it("springs back from a short, slow drag", async () => {
    const { onSwipe, card } = await renderCard();

    await drag(card, 40, 20);
    await expect
      .poll(() => getComputedStyle(card).transform)
      .toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
    expect(onSwipe).not.toHaveBeenCalled();
  });

  it("ignores drags while disabled", async () => {
    const { onSwipe, card } = await renderCard(true);

    await drag(card, 220, 12);
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(onSwipe).not.toHaveBeenCalled();
  });
});
