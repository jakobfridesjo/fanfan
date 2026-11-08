import { page as screen, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { describe, expect, it } from "vitest";
import * as z from "zod/mini";
import { NonEmptyTrimmedStringSchema } from "@/shared/lib/field-schemas.ts";
import { schemaFormOptions, useAppForm } from "@/shared/lib/form.ts";
import { useEditorView } from "@/shared/lib/use-editor-view.ts";

const Schema = z.object({
  name: NonEmptyTrimmedStringSchema,
  nested: z.object({ email: NonEmptyTrimmedStringSchema }),
});

const EMPTY = { name: "", nested: { email: "" } };

const options = schemaFormOptions(Schema, EMPTY);

function Harness() {
  const form = useAppForm(options);
  const editor = useEditorView<{ id: string }, typeof EMPTY>(form, EMPTY);

  return (
    <form>
      <form.Field name="name">
        {(field) => (
          <>
            <label>
              Name
              <input
                value={field.value}
                onChange={(event) => field.handleChange(event.target.value)}
                onBlur={field.handleBlur}
                aria-invalid={field.errors.length > 0}
              />
            </label>
            <output data-testid="name-errors">
              {field.errors.map((error) => error.message).join(",")}
            </output>
          </>
        )}
      </form.Field>
      <form.Field name="nested.email">
        {(field) => (
          <output data-testid="email-errors">
            {field.errors.map((error) => error.message).join(",")}
          </output>
        )}
      </form.Field>
      <form.Subscribe selector={({ canSubmit }) => canSubmit}>
        {(canSubmit) => <output data-testid="can-submit">{String(canSubmit)}</output>}
      </form.Subscribe>
      <output data-testid="dirty">{String(editor.dirty)}</output>
      <output data-testid="editing">{editor.editing?.id ?? "none"}</output>
      <button type="button" onClick={() => void form.handleSubmit()}>
        Submit
      </button>
      <button
        type="button"
        onClick={() => editor.openEdit({ id: "a" }, { name: "Ada", nested: { email: "a@b.c" } })}
      >
        Edit
      </button>
      <button type="button" onClick={editor.close}>
        Close
      </button>
    </form>
  );
}

describe("schemaFormOptions", () => {
  it("validates on mount without showing errors, so submit is blocked up front", async () => {
    await render(<Harness />);

    await expect.element(screen.getByTestId("can-submit")).toHaveTextContent("false");
    await expect.element(screen.getByTestId("name-errors")).toHaveTextContent("");
  });

  it("hides errors until a field is blurred, then shows only that field's errors", async () => {
    await render(<Harness />);
    const name = screen.getByLabelText("Name");

    await expect.element(name).toHaveAttribute("aria-invalid", "false");
    await expect.element(screen.getByTestId("name-errors")).toHaveTextContent("");

    await name.click();
    await userEvent.keyboard("{Tab}");

    await expect.element(name).toHaveAttribute("aria-invalid", "true");
    await expect.element(screen.getByTestId("name-errors")).toHaveTextContent("Required");
    await expect.element(screen.getByTestId("email-errors")).toHaveTextContent("");
  });

  it("reveals every error on submit and drops an error once the value becomes valid", async () => {
    await render(<Harness />);

    await screen.getByRole("button", { name: "Submit" }).click();
    await expect.element(screen.getByTestId("email-errors")).toHaveTextContent("Required");
    await expect.element(screen.getByTestId("name-errors")).toHaveTextContent("Required");

    await screen.getByLabelText("Name").fill("Ada");
    await expect.element(screen.getByTestId("name-errors")).toHaveTextContent("");
  });
});

describe("useEditorView", () => {
  it("is dirty only while values differ from the ones it opened with", async () => {
    await render(<Harness />);
    const name = screen.getByLabelText("Name");

    await screen.getByRole("button", { name: "Edit" }).click();
    await expect.element(name).toHaveValue("Ada");
    await expect.element(screen.getByTestId("editing")).toHaveTextContent("a");
    await expect.element(screen.getByTestId("dirty")).toHaveTextContent("false");

    await name.fill("Grace");
    await expect.element(screen.getByTestId("dirty")).toHaveTextContent("true");

    await name.fill("Ada");
    await expect.element(screen.getByTestId("dirty")).toHaveTextContent("false");
    await expect.element(screen.getByTestId("can-submit")).toHaveTextContent("true");
  });

  it("clears values, errors and the edited entity on close", async () => {
    await render(<Harness />);

    await screen.getByRole("button", { name: "Edit" }).click();
    await screen.getByLabelText("Name").fill("");
    await screen.getByRole("button", { name: "Submit" }).click();
    await expect.element(screen.getByTestId("name-errors")).toHaveTextContent("Required");

    await screen.getByRole("button", { name: "Close" }).click();
    await expect.element(screen.getByLabelText("Name")).toHaveValue("");
    await expect.element(screen.getByTestId("name-errors")).toHaveTextContent("");
    await expect.element(screen.getByTestId("editing")).toHaveTextContent("none");
    await expect.element(screen.getByTestId("dirty")).toHaveTextContent("false");
    await expect.element(screen.getByTestId("can-submit")).toHaveTextContent("false");
  });
});
