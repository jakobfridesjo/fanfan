import { notFound } from "@tanstack/react-router";

/** `$documentId` as a positive integer; anything else is not found. */
export const documentIdParams = {
  parse: ({ documentId }: { documentId: string }) => {
    const id = Number(documentId);
    if (!Number.isInteger(id) || id <= 0) throw notFound();
    return { documentId: id };
  },
  stringify: ({ documentId }: { documentId: number }) => ({ documentId: String(documentId) }),
};
