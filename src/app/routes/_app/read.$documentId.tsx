import { noop } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { documentIdParams } from "@/app/routes/-document-id-params.ts";
import { documentsQuery, sectionsQuery } from "@/shared/api/queries.ts";
import { scriptAtom } from "@/shared/config/preferences.ts";
import ReaderManager from "@/pages/reader/ui/ReaderManager.tsx";

export const Route = createFileRoute("/_app/read/$documentId")({
  params: documentIdParams,
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
