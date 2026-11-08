import { noop } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { wordCountsQuery } from "@/shared/api/queries.ts";
import KnownWordsManager from "@/pages/known-words/ui/KnownWordsManager.tsx";

export const Route = createFileRoute("/_app/known-words")({
  loader: ({ context }) => {
    void context.queryClient.query(wordCountsQuery()).catch(noop);
  },
  component: KnownWordsManager,
});
