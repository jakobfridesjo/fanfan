import { noop } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { wordListQuery } from "@/shared/api/queries.ts";
import { scriptAtom } from "@/shared/config/preferences.ts";
import KnownWordsManager from "@/pages/known-words/ui/KnownWordsManager.tsx";

export const Route = createFileRoute("/_app/known-words")({
  loader: ({ context }) => {
    void context.queryClient.query(wordListQuery(scriptAtom.get())).catch(noop);
  },
  component: KnownWordsManager,
});
