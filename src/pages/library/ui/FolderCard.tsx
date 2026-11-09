import type { DocumentSummary, Folder } from "@/shared/api/commands.ts";
import { useMessages } from "@/shared/i18n/messages.ts";
import { cn } from "@/shared/lib/class-names.ts";
import { DocumentCover } from "@/entities/document/ui/DocumentCover.tsx";
import { dropTargetProps } from "@/pages/library/model/use-shelf-drag.ts";
import { LANDING, POSTER } from "@/pages/library/ui/poster.ts";

/** Up to four of its books' covers, and its name. */
export function FolderCard({
  folder,
  documents,
  landing,
  onOpen,
}: {
  folder: Folder;
  documents: DocumentSummary[];
  landing: boolean;
  onOpen: () => void;
}) {
  const m = useMessages();
  return (
    <div className="group relative" {...dropTargetProps({ kind: "folder", id: folder.id })}>
      <button
        type="button"
        onClick={onOpen}
        aria-label={m.library.openFolder(folder.name, documents.length)}
        title={folder.name}
        className={cn(
          POSTER,
          "flex w-full flex-col gap-2 bg-card p-2.5 text-left text-card-foreground",
          landing && LANDING
        )}
      >
        <span className="grid min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-1.5">
          {documents.slice(0, 4).map((document) => (
            <span key={document.id} className="overflow-hidden rounded-md shadow-sm">
              <DocumentCover document={document} thumbnail />
            </span>
          ))}
        </span>
        <span lang="zh" className="truncate px-0.5 font-medium">
          {folder.name}
        </span>
      </button>
    </div>
  );
}
