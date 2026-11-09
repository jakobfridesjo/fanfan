import { noop } from "@tanstack/react-query";
import { scriptAtom } from "@/shared/config/preferences.ts";
import { createFileRoute } from "@tanstack/react-router";
import { documentIdParams } from "@/app/routes/-document-id-params.ts";
import { deckQuery } from "@/shared/api/queries.ts";
import DeckManager from "@/pages/deck/ui/DeckManager.tsx";

export const Route = createFileRoute("/_app/library/$documentId")({
  params: documentIdParams,
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
