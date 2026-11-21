import { Show } from "solid-js";
import { noop } from "@tanstack/solid-query";
import { createFileRoute } from "@tanstack/solid-router";
import * as z from "zod/mini";
import { scriptAtom } from "@/shared/config/preferences.ts";
import { documentsQuery, reviewQueueQuery } from "@/shared/api/queries.ts";
import ReviewManager from "@/pages/review/ui/ReviewManager.tsx";

export const Route = createFileRoute("/_app/review")({
  /** `document` keeps the reviews to one book's words. */
  validateSearch: z.object({ document: z.catch(z.optional(z.number()), undefined) }),
  loaderDeps: ({ search }) => ({ documentId: search.document ?? null }),
  loader: ({ context, deps }) => {
    void context.queryClient.query(reviewQueueQuery(scriptAtom.get(), deps.documentId)).catch(noop);
    void context.queryClient.query(documentsQuery()).catch(noop);
  },
  component: ReviewRoute,
});

const ALL_BOOKS = "all";

function ReviewRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  // Keyed so another choice of book starts a fresh session, undo history included.
  return (
    <Show when={`${search().document ?? ALL_BOOKS}`} keyed>
      {(choice) => (
        <ReviewManager
          documentId={choice === ALL_BOOKS ? null : Number(choice)}
          onDocumentChange={(documentId) =>
            void navigate({
              search: documentId === null ? {} : { document: documentId },
              replace: true,
            })
          }
        />
      )}
    </Show>
  );
}
