import { describe, expect, it } from "vitest";
import { getSidebarDefaultOpen } from "@/app/layouts/sidebar-default-open.ts";

describe("getSidebarDefaultOpen", () => {
  it("defaults to expanded when no sidebar cookie exists", () => {
    expect(getSidebarDefaultOpen("theme=dark")).toBe(true);
  });

  it("restores an expanded sidebar from the persisted cookie", () => {
    expect(getSidebarDefaultOpen("theme=dark; sidebar_state=true")).toBe(true);
  });

  it("restores a collapsed sidebar from the persisted cookie", () => {
    expect(getSidebarDefaultOpen("theme=dark; sidebar_state=false; other=value")).toBe(false);
  });
});
