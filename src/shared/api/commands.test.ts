import { describe, expect, it } from "vitest";
import { commandErrorMessage } from "@/shared/api/commands.ts";

describe("commandErrorMessage", () => {
  it("uses the message Rust rejected with", () => {
    expect(commandErrorMessage("The file contains no Chinese text", "Import failed")).toBe(
      "The file contains no Chinese text"
    );
  });

  it("uses an Error's message", () => {
    expect(commandErrorMessage(new Error("IPC failed"), "Import failed")).toBe("IPC failed");
  });

  it("falls back when there is nothing to say", () => {
    expect(commandErrorMessage("  ", "Import failed")).toBe("Import failed");
    expect(commandErrorMessage(undefined, "Import failed")).toBe("Import failed");
    expect(commandErrorMessage(new Error(""), "Import failed")).toBe("Import failed");
  });
});
