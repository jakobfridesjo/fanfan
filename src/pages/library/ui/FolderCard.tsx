import { For } from "solid-js";
import type { DocumentSummary, Folder } from "@/shared/api/commands.ts";
import { useMessages } from "@/shared/i18n/messages.ts";
import { cn } from "@/shared/lib/class-names.ts";
import { DocumentCover } from "@/entities/document/ui/DocumentCover.tsx";
import { dropTargetProps } from "@/pages/library/model/use-shelf-drag.ts";
import { LANDING, POSTER } from "@/pages/library/ui/poster.ts";

/** Up to four of its books' covers, and its name. */
export function FolderCard(props: {
  folder: Folder;
  documents: DocumentSummary[];
  landing: boolean;
  onOpen: () => void;
}) {
  const m = useMessages();
  return (
    <div class="group relative" {...dropTargetProps({ kind: "folder", id: props.folder.id })}>
      <button
        type="button"
        onClick={() => props.onOpen()}
        aria-label={m.library.openFolder(props.folder.name, props.documents.length)}
        title={props.folder.name}
        class={cn(
          POSTER,
          "flex w-full flex-col gap-2 bg-card p-2.5 text-left text-card-foreground",
          props.landing && LANDING
        )}
      >
        <span class="grid min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-1.5">
          <For each={props.documents.slice(0, 4)} keyed={(document) => document.id}>
            {(document) => (
              <span class="overflow-hidden rounded-md shadow-sm">
                <DocumentCover document={document()} thumbnail />
              </span>
            )}
          </For>
        </span>
        <span lang="zh" class="truncate px-0.5 font-medium">
          {props.folder.name}
        </span>
      </button>
    </div>
  );
}
