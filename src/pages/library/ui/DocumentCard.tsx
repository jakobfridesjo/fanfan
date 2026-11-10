import { Link } from "@tanstack/react-router";
import { BookCheck, FolderOutput, Trash2 } from "lucide-react";
import type { DocumentSummary } from "@/shared/api/commands.ts";
import { useMessages } from "@/shared/i18n/messages.ts";
import { cn } from "@/shared/lib/class-names.ts";
import { coverageOf, formatShare } from "@/entities/document/model/coverage.ts";
import { CoverageBar } from "@/entities/document/ui/CoverageBar.tsx";
import { DocumentCover } from "@/entities/document/ui/DocumentCover.tsx";
import {
  dropTargetProps,
  type DragHandlers,
  type ShelfDrag,
} from "@/pages/library/model/use-shelf-drag.ts";
import { LANDING, POSTER } from "@/pages/library/ui/poster.ts";

/** A translucent triangle in a corner of the cover, holding an icon. */
const CORNER =
  "pointer-events-auto absolute size-12 bg-background/55 text-foreground backdrop-blur-sm transition-colors outline-none hover:bg-background/85 focus-visible:bg-primary focus-visible:text-primary-foreground motion-reduce:transition-none [&_svg]:absolute [&_svg]:size-4";
const TOP_RIGHT =
  "top-0 right-0 [clip-path:polygon(0_0,100%_0,100%_100%)] [&_svg]:top-2 [&_svg]:right-2";
const BOTTOM_RIGHT =
  "right-0 bottom-1.5 [clip-path:polygon(100%_0,100%_100%,0_100%)] [&_svg]:right-2 [&_svg]:bottom-2";
const BOTTOM_LEFT =
  "bottom-1.5 left-0 [clip-path:polygon(0_0,100%_100%,0_100%)] [&_svg]:bottom-2 [&_svg]:left-2";

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

/**
 * A cover that opens the reader, with corners that delete the book (top right),
 * study its words (bottom right) and, in a folder, take it out (bottom left).
 */
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
  const params = { documentId: document.id };
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
        "group relative select-none [-webkit-touch-callout:none]",
        drag && "pointer-events-none z-10 scale-105 opacity-80"
      )}
    >
      <Link
        to="/read/$documentId"
        params={params}
        draggable={false}
        aria-label={m.library.readBook(document.title)}
        title={details}
        className={cn(POSTER, "bg-muted", landing && LANDING, drag && "shadow-xl")}
      >
        <DocumentCover document={document} />
        <CoverageBar document={document} variant="strip" className="absolute inset-x-0 bottom-0" />
      </Link>
      {!drag && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl transition-transform group-hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0">
          <button
            type="button"
            aria-label={m.library.deleteBook(document.title)}
            title={m.common.delete}
            onClick={onDelete}
            className={cn(CORNER, TOP_RIGHT)}
          >
            <Trash2 />
          </button>
          <Link
            to="/library/$documentId"
            params={params}
            draggable={false}
            aria-label={m.library.studyBook(document.title)}
            title={m.library.wordsToSort(document.unseenWords, document.uniqueWords)}
            className={cn(CORNER, BOTTOM_RIGHT)}
          >
            <BookCheck />
          </Link>
          {onTakeOut && (
            <button
              type="button"
              aria-label={m.library.takeOutOfFolder(document.title)}
              title={m.library.takeOut}
              onClick={onTakeOut}
              className={cn(CORNER, BOTTOM_LEFT)}
            >
              <FolderOutput />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
