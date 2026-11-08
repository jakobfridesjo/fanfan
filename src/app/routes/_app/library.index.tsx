import { noop } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { documentsQuery, foldersQuery } from "@/shared/api/queries.ts";
import LibraryManager from "@/pages/library/ui/LibraryManager.tsx";

export const Route = createFileRoute("/_app/library/")({
  loader: ({ context }) => {
    // Start loading as navigation begins; the page reads the warm cache.
    void context.queryClient.query(documentsQuery()).catch(noop);
    void context.queryClient.query(foldersQuery()).catch(noop);
  },
  component: LibraryManager,
});
