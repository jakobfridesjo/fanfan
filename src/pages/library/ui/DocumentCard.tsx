import { Link } from "@tanstack/react-router";
import { BookCheck, FolderOutput, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import type { DocumentSummary } from "@/shared/api/commands.ts";
import { useMessages } from "@/shared/i18n/messages.ts";
import { cn } from "@/shared/lib/class-names.ts";
import { Button, buttonVariants } from "@/shared/ui/shadcn/button.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/shadcn/dropdown-menu.tsx";
import { coverageOf, formatShare } from "@/entities/document/model/coverage.ts";
import { CoverageBar } from "@/entities/document/ui/CoverageBar.tsx";
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
  onRename: () => void;
  onDelete: () => void;
  /** Shown inside a folder. */
  onTakeOut?: () => void;
}

/**
 * A cover that opens the reader, and below it a link to study its words and a menu
 * that renames or deletes the book or, in a folder, takes it out.
 */
export function DocumentCard({
  document,
  drag,
  dragHandlers,
  acceptsDrop,
  landing,
  onRename,
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
      {...(acceptsDrop && dropTargetProps({ kind: "document", id: document.id }))}
      style={drag ? { translate: `${drag.offset.x}px ${drag.offset.y}px` } : undefined}
      className={cn(
        "group flex flex-col gap-1.5 select-none [-webkit-touch-callout:none]",
        drag && "pointer-events-none z-10 scale-105 opacity-80"
      )}
    >
      <Link
        {...dragHandlers}
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
      <div className={cn("flex items-center justify-between gap-1", drag && "invisible")}>
        <Link
          to="/library/$documentId"
          params={params}
          draggable={false}
          aria-label={m.library.studyBook(document.title)}
          title={m.library.wordsToSort(document.unseenWords, document.uniqueWords)}
          className={buttonVariants({
            variant: "ghost",
            size: "xs",
            className: "-ml-1.5 min-w-0 text-muted-foreground",
          })}
        >
          <BookCheck />
          <span className="truncate">{m.library.toSort(document.unseenWords)}</span>
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon-xs" className="-mr-1 text-muted-foreground" />
            }
            aria-label={m.library.bookActions(document.title)}
          >
            <MoreHorizontal />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-auto">
            {onTakeOut && (
              <DropdownMenuItem onClick={onTakeOut}>
                <FolderOutput />
                {m.library.takeOut}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={onRename}>
              <Pencil />
              {m.common.rename}
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={onDelete}>
              <Trash2 />
              {m.common.delete}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
