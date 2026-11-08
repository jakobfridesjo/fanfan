import { noop } from "@tanstack/react-query";
import { scriptAtom } from "@/shared/config/preferences.ts";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { deckQuery } from "@/shared/api/queries.ts";
import DeckManager from "@/pages/deck/ui/DeckManager.tsx";

export const Route = createFileRoute("/_app/library/$documentId")({
  params: {
    parse: ({ documentId }) => {
      const id = Number(documentId);
      if (!Number.isInteger(id) || id <= 0) throw notFound();
      return { documentId: id };
    },
    stringify: ({ documentId }) => ({ documentId: String(documentId) }),
  },
  loader: ({ context, params }) => {
    void context.queryClient.query(deckQuery(params.documentId, scriptAtom.get())).catch(noop);
  },
  component: DeckRoute,
});

function DeckRoute() {
  const { documentId } = Route.useParams();
  // Keyed so a different book starts with a fresh deck, undo history included.
  return <DeckManager key={documentId} documentId={documentId} />;
}
