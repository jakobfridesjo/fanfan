import { noop } from "@tanstack/react-query";
import { scriptAtom } from "@/shared/config/preferences.ts";
import { createFileRoute } from "@tanstack/react-router";
import { reviewQueueQuery } from "@/shared/api/queries.ts";
import ReviewManager from "@/pages/review/ui/ReviewManager.tsx";

export const Route = createFileRoute("/_app/review")({
  loader: ({ context }) => {
    void context.queryClient.query(reviewQueueQuery(scriptAtom.get())).catch(noop);
  },
  component: ReviewManager,
});
