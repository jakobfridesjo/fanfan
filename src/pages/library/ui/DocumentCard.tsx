import { Link, useNavigate } from "@tanstack/solid-router";
import { BookCheck, CalendarCheck, Ellipsis, FolderOutput, Pencil, Trash2 } from "lucide";
import { Show } from "solid-js";
import type { DocumentSummary } from "@/shared/api/commands.ts";
import { useMessages } from "@/shared/i18n/messages.ts";
import { cn } from "@/shared/lib/class-names.ts";
import { Icon } from "@/shared/ui/Icon.tsx";
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
export function DocumentCard(props: DocumentCardProps) {
  const m = useMessages();
  const navigate = useNavigate();
  const params = () => ({ documentId: props.document.id });
  const toSort = () =>
    m.library.wordsToSort(props.document.unseenWords, props.document.uniqueWords);
  const details = () => {
    const { known, learning } = coverageOf(props.document);
    return [
      props.document.title,
      `${m.coverage.known(formatShare(known))}, ${m.coverage.learning(formatShare(learning))}`,
      toSort(),
    ].join("\n");
  };
  const dropTarget = () =>
    props.acceptsDrop ? dropTargetProps({ kind: "document", id: props.document.id }) : {};

  return (
    <div
      {...dropTarget()}
      style={
        props.drag
          ? { translate: `${props.drag.offset.x}px ${props.drag.offset.y}px` }
          : { translate: undefined }
      }
      class={cn(
        "group flex flex-col gap-1.5 select-none [-webkit-touch-callout:none]",
        props.drag && "pointer-events-none z-10 scale-105 opacity-80"
      )}
    >
      <Link
        onPointerDown={(event: PointerEvent) => props.dragHandlers.onPointerDown(event)}
        onContextMenu={(event: MouseEvent) => props.dragHandlers.onContextMenu(event)}
        onClick={(event: MouseEvent) => props.dragHandlers.onClick(event)}
        to="/read/$documentId"
        params={params()}
        draggable={false}
        aria-label={m.library.readBook(props.document.title)}
        title={details()}
        class={cn(POSTER, "bg-muted", props.landing && LANDING, props.drag && "shadow-xl")}
      >
        <DocumentCover document={props.document} />
        <CoverageBar
          document={props.document}
          variant="strip"
          class="absolute inset-x-0 bottom-0"
        />
      </Link>
      <div class={cn("flex items-center justify-between gap-1", props.drag && "invisible")}>
        <Link
          to="/library/$documentId"
          params={params()}
          draggable={false}
          aria-label={m.library.studyBook(props.document.title)}
          title={toSort()}
          class={buttonVariants({
            variant: "ghost",
            size: "xs",
            className: "-ml-1.5 min-w-0 text-muted-foreground",
          })}
        >
          <Icon icon={BookCheck} />
          <span class="truncate">{m.library.toSort(props.document.unseenWords)}</span>
        </Link>
        <DropdownMenu placement="bottom-end">
          <DropdownMenuTrigger
            as={Button}
            variant="ghost"
            size="icon-xs"
            class="-mr-1 text-muted-foreground"
            aria-label={m.library.bookActions(props.document.title)}
          >
            <Icon icon={Ellipsis} />
          </DropdownMenuTrigger>
          <DropdownMenuContent class="w-auto">
            <DropdownMenuItem
              onSelect={() =>
                void navigate({ to: "/review", search: { document: props.document.id } })
              }
            >
              <Icon icon={CalendarCheck} />
              {m.library.reviewBook}
            </DropdownMenuItem>
            <Show when={props.onTakeOut}>
              <DropdownMenuItem onSelect={() => props.onTakeOut?.()}>
                <Icon icon={FolderOutput} />
                {m.library.takeOut}
              </DropdownMenuItem>
            </Show>
            <DropdownMenuItem onSelect={() => props.onRename()}>
              <Icon icon={Pencil} />
              {m.common.rename}
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={() => props.onDelete()}>
              <Icon icon={Trash2} />
              {m.common.delete}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
