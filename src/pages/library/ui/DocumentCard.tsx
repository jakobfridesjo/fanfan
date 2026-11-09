import { Link, useNavigate } from "@tanstack/react-router";
import { BookOpen, FolderOutput, Trash2 } from "lucide-react";
import type { DocumentSummary } from "@/shared/api/commands.ts";
import { useMessages } from "@/shared/i18n/messages.ts";
import { cn } from "@/shared/lib/class-names.ts";
import { TooltipIconButton } from "@/shared/ui/TooltipIconButton.tsx";
import { coverageOf, formatShare } from "@/entities/document/model/coverage.ts";
import { CoverageStrip } from "@/entities/document/ui/CoverageStrip.tsx";
import { DocumentCover } from "@/entities/document/ui/DocumentCover.tsx";
import {
  dropTargetProps,
  type DragHandlers,
  type ShelfDrag,
} from "@/pages/library/model/use-shelf-drag.ts";
import { LANDING, POSTER } from "@/pages/library/ui/poster.ts";

interface DocumentCardProps {
  document: DocumentSummary;
  /** Set while this book is being dragged. */
  drag: ShelfDrag | null;
  dragHandlers: DragHandlers;
  /** Whether another book dropped here makes a folder of the two. */
  acceptsDrop: boolean;
  landing: boolean;
  onDelete: () => void;
  /** Shown inside a folder. */
  onTakeOut?: () => void;
}
export function DocumentCard({
  document,
  drag,
  dragHandlers,
  acceptsDrop,
  landing,
  onDelete,
  onTakeOut,
}: DocumentCardProps) {
  const m = useMessages();
  const navigate = useNavigate();
  const { known, learning } = coverageOf(document);
  const details = [
    document.title,
    `${m.coverage.known(formatShare(known))}, ${m.coverage.learning(formatShare(learning))}`,
    m.library.wordsToSort(document.unseenWords, document.uniqueWords),
  ].join("\n");

  return (
    <div
      {...dragHandlers}
      {...(acceptsDrop && dropTargetProps({ kind: "document", id: document.id }))}
      style={drag ? { translate: `${drag.offset.x}px ${drag.offset.y}px` } : undefined}
      className={cn(
        "group relative touch-none select-none",
        drag && "pointer-events-none z-10 opacity-80"
      )}
    >
      <Link
        to="/library/$documentId"
        params={{ documentId: document.id }}
        draggable={false}
        aria-label={m.library.studyBook(document.title)}
        title={details}
        className={cn(POSTER, "bg-muted", landing && LANDING, drag && "shadow-xl")}
      >
        <DocumentCover document={document} />
        <CoverageStrip document={document} className="absolute inset-x-0 bottom-0" />
      </Link>
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 has-focus-visible:opacity-100 motion-reduce:transition-none">
        <TooltipIconButton
          label={m.library.readBook(document.title)}
          tooltip={m.library.read}
          variant="secondary"
          size="icon-sm"
          onClick={() =>
            void navigate({ to: "/read/$documentId", params: { documentId: document.id } })
          }
          className="shadow-sm"
        >
          <BookOpen />
        </TooltipIconButton>
        {onTakeOut && (
          <TooltipIconButton
            label={m.library.takeOutOfFolder(document.title)}
            tooltip={m.library.takeOut}
            variant="secondary"
            size="icon-sm"
            onClick={onTakeOut}
            className="shadow-sm"
          >
            <FolderOutput />
          </TooltipIconButton>
        )}
        <TooltipIconButton
          label={m.library.deleteBook(document.title)}
          tooltip={m.common.delete}
          variant="secondary"
          size="icon-sm"
          onClick={onDelete}
          className="shadow-sm"
        >
          <Trash2 />
        </TooltipIconButton>
      </div>
    </div>
  );
}
