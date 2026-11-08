import { useState } from "react";
import { useSelector } from "@tanstack/react-store";
import type { AnyFormApi } from "@tanstack/react-form";
import { loadForm } from "@/shared/lib/form.ts";

export interface EditorView<TEntity, TForm> {
  open: boolean;
  editing: TEntity | null;
  dirty: boolean;
  openCreate: () => void;
  openEdit: (entity: TEntity, values: TForm) => void;
  close: () => void;
}

type EditorForm<TForm> = Pick<AnyFormApi, "atom" | "validate"> & {
  reset: (values: TForm) => void;
};

export function useEditorView<TEntity, TForm>(
  form: EditorForm<TForm>,
  emptyForm: TForm
): EditorView<TEntity, TForm> {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TEntity | null>(null);
  const dirty = useSelector(form.atom, (state) => !state.isDefaultValue);

  const load = (values: TForm) => loadForm(form, values);

  const openCreate = () => {
    setEditing(null);
    load(emptyForm);
    setOpen(true);
  };

  const openEdit = (entity: TEntity, values: TForm) => {
    setEditing(entity);
    load(values);
    setOpen(true);
  };

  const close = () => {
    setOpen(false);
    setEditing(null);
    load(emptyForm);
  };

  return { open, editing, dirty, openCreate, openEdit, close };
}
