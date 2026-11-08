import { page as screen } from "vitest/browser";
import { describe, expect, it, vi } from "vitest";
import { renderPage } from "@/shared/test/render.tsx";

// The banner text is a build-time constant, so the configured case takes a
// separate file from layout.test.tsx, which leaves it unset.
vi.mock("@/shared/config/env.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/config/env.ts")>()),
  headerText: "Production data",
  headerColor: "#fde047",
}));

const { PageHeader } = await import("@/shared/ui/PageHeader.tsx");

describe("PageHeader", () => {
  it("shows the configured header text", async () => {
    await renderPage(<PageHeader title="Templates" />);

    await expect.element(screen.getByRole("status")).toHaveTextContent("Production data");
  });

  it("colors the header text with the configured color", async () => {
    await renderPage(<PageHeader title="Templates" />);

    await expect
      .element(screen.getByRole("status"))
      .toHaveStyle({ backgroundColor: "rgb(253, 224, 71)", color: "rgb(0, 0, 0)" });
  });
});
