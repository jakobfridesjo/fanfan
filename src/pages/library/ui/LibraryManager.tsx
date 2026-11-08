import { Link, useNavigate } from "@tanstack/react-router";
import { BookOpen, FileUp, FolderOutput, Pencil, Plus, Trash2 } from "lucide-react";
import type { DocumentSummary, Folder } from "@/shared/api/commands.ts";
import { useMessages } from "@/shared/i18n/messages.ts";
import { cn } from "@/shared/lib/class-names.ts";
import { ConfirmationDialog } from "@/shared/ui/ConfirmationDialog.tsx";
import { PageHeader } from "@/shared/ui/PageHeader.tsx";
import { TooltipIconButton } from "@/shared/ui/TooltipIconButton.tsx";
import { Button } from "@/shared/ui/shadcn/button.tsx";
import { Card, CardContent } from "@/shared/ui/shadcn/card.tsx";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/shared/ui/shadcn/empty.tsx";
import { Skeleton } from "@/shared/ui/shadcn/skeleton.tsx";
import { Spinner } from "@/shared/ui/shadcn/spinner.tsx";
import { coverageOf, formatShare } from "@/entities/document/model/coverage.ts";
import { CoverageStrip } from "@/entities/document/ui/CoverageStrip.tsx";
import { DocumentCover } from "@/entities/document/ui/DocumentCover.tsx";
import {
  useLibraryManager,
  type ImportProgress,
} from "@/pages/library/model/use-library-manager.ts";
import {
  dropTargetProps,
  type DragHandlers,
  type ShelfDrag,
} from "@/pages/library/model/use-shelf-drag.ts";
import { FolderNameDialog } from "@/pages/library/ui/FolderNameDialog.tsx";

/** Covers as posters, as many to a row as fit. */
const SHELF = "grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-4";

/** A poster on the shelf; lifted while hovered, ringed while a book hovers over it to land. */
const POSTER =
  "relative block aspect-2/3 overflow-hidden rounded-xl shadow-md ring-1 ring-foreground/10 transition-[box-shadow,translate,scale] outline-none group-hover:-translate-y-0.5 group-hover:shadow-lg focus-visible:ring-3 focus-visible:ring-ring motion-reduce:transition-none motion-reduce:group-hover:translate-y-0";
const LANDING = "scale-105 ring-3 ring-primary";

function LibraryManager() {
  const m = useMessages();
  const {
    documents,
    loading,
    importing,
    progress,
    chooseFile,
    deletingDocument,
    setDeletingDocument,
    deleting,
    confirmDelete,
    items,
    openFolder,
    setOpenFolderId,
    takeOutOfFolder,
    drag,
    dragHandlers,
    folderDialog,
    setFolderDialog,
    submitFolderName,
    savingFolder,
  } = useLibraryManager();
  const landing = (kind: "document" | "folder", id: number) =>
    drag?.over?.kind === kind && drag.over.id === id;

  return (
    <>
      {openFolder ? (
        <PageHeader
          title={<span lang="zh">{openFolder.name}</span>}
          onBack={() => setOpenFolderId(null)}
          backLabel={m.deck.backToLibrary}
        >
          <Button
            type="button"
            variant="outline"
            aria-label={m.library.renameFolderLabel}
            onClick={() => setFolderDialog({ kind: "rename", folder: openFolder })}
          >
            <Pencil data-icon="inline-start" />
            {m.library.renameFolder}
          </Button>
        </PageHeader>
      ) : (
        <PageHeader title={m.library.title} />
      )}

      <div className="-m-1 flex min-h-0 flex-col gap-4 overflow-y-auto p-1">
        {progress && <ImportProgressCard progress={progress} />}

        {loading ? (
          <LibrarySkeleton />
        ) : documents.length === 0 ? (
          !progress && (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <BookOpen />
                </EmptyMedia>
                <EmptyTitle>{m.library.emptyTitle}</EmptyTitle>
                <EmptyDescription>{m.library.emptyDescription}</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button type="button" onClick={() => void chooseFile()} disabled={importing}>
                  <FileUp data-icon="inline-start" />
                  {m.library.importBook}
                </Button>
              </EmptyContent>
            </Empty>
          )
        ) : (
          <div className={SHELF}>
            {!openFolder && <ImportSlot onClick={() => void chooseFile()} disabled={importing} />}
            {items.map((item) =>
              item.kind === "folder" ? (
                <FolderCard
                  key={`folder-${item.folder.id}`}
                  folder={item.folder}
                  documents={item.documents}
                  landing={landing("folder", item.folder.id)}
                  onOpen={() => setOpenFolderId(item.folder.id)}
                />
              ) : (
                <DocumentCard
                  key={item.document.id}
                  document={item.document}
                  drag={drag?.documentId === item.document.id ? drag : null}
                  dragHandlers={dragHandlers(item.document.id)}
                  acceptsDrop={!openFolder}
                  landing={landing("document", item.document.id)}
                  onDelete={() => setDeletingDocument(item.document)}
                  onTakeOut={openFolder ? () => takeOutOfFolder(item.document) : undefined}
                />
              )
            )}
          </div>
        )}
      </div>

      <ConfirmationDialog
        open={deletingDocument !== null}
        onClose={() => setDeletingDocument(null)}
        onConfirm={confirmDelete}
        confirmLabel={m.common.delete}
        destructive
        loading={deleting}
        title={m.library.deleteTitle}
        message={m.library.deleteMessage(deletingDocument?.title ?? "")}
      />

      {folderDialog && (
        <FolderNameDialog
          dialog={folderDialog}
          saving={savingFolder}
          onSubmit={submitFolderName}
          onClose={() => setFolderDialog(null)}
        />
      )}
    </>
  );
}

function ImportProgressCard({ progress }: { progress: ImportProgress }) {
  const m = useMessages();
  return (
    <Card size="sm" className="shrink-0" role="status">
      <CardContent className="flex items-center gap-3">
        <Spinner />
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-medium">{m.library.importing(progress.fileName)}</span>
          <span className="text-muted-foreground">
            {m.library.stages[progress.stage ?? "dictionary"]}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

/** An empty spot on the shelf, waiting for the next book. */
function ImportSlot({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  const m = useMessages();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={m.library.importBook}
      title={m.library.importBook}
      className="flex aspect-2/3 items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/30 text-muted-foreground transition-colors outline-none hover:border-muted-foreground/60 hover:bg-muted/50 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none"
    >
      <Plus className="size-10" strokeWidth={1.5} />
    </button>
  );
}

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

function DocumentCard({
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

/** Up to four of its books' covers, and its name. */
function FolderCard({
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
          "flex w-full flex-col gap-2 bg-muted/70 p-2.5 text-left backdrop-blur-sm",
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

function LibrarySkeleton() {
  return (
    <div className={SHELF} aria-hidden>
      {["first", "second", "third", "fourth"].map((key) => (
        <Skeleton key={key} className="aspect-2/3 rounded-xl motion-reduce:animate-none" />
      ))}
    </div>
  );
}

export default LibraryManager;
