import { noop } from "@tanstack/react-query";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { documentsQuery, sectionsQuery } from "@/shared/api/queries.ts";
import { scriptAtom } from "@/shared/config/preferences.ts";
import ReaderManager from "@/pages/reader/ui/ReaderManager.tsx";

export const Route = createFileRoute("/_app/read/$documentId")({
  params: {
    parse: ({ documentId }) => {
      const id = Number(documentId);
      if (!Number.isInteger(id) || id <= 0) throw notFound();
      return { documentId: id };
    },
    stringify: ({ documentId }) => ({ documentId: String(documentId) }),
  },
  loader: ({ context, params }) => {
    void context.queryClient.query(documentsQuery()).catch(noop);
    void context.queryClient.query(sectionsQuery(params.documentId, scriptAtom.get())).catch(noop);
  },
  component: ReaderRoute,
});

function ReaderRoute() {
  const { documentId } = Route.useParams();
  // Keyed so another book starts at its own reading position.
  return <ReaderManager key={documentId} documentId={documentId} />;
}
