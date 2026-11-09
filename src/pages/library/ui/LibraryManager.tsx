import { BookOpen, FileUp, Pencil, Plus } from "lucide-react";
import { useMessages } from "@/shared/i18n/messages.ts";
import { ConfirmationDialog } from "@/shared/ui/ConfirmationDialog.tsx";
import { PageHeader } from "@/shared/ui/PageHeader.tsx";
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
import {
  useLibraryManager,
  type ImportProgress,
} from "@/pages/library/model/use-library-manager.ts";
import { DocumentCard } from "@/pages/library/ui/DocumentCard.tsx";
import { FolderCard } from "@/pages/library/ui/FolderCard.tsx";
import { FolderNameDialog } from "@/pages/library/ui/FolderNameDialog.tsx";

/** Covers as posters, as many to a row as fit. */
const SHELF = "grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-4";

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

      <div className="-m-1 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-1">
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

function LibrarySkeleton() {
  return (
    <div className={SHELF} aria-hidden>
      {["first", "second", "third", "fourth"].map((key) => (
        <Skeleton key={key} className="aspect-2/3 rounded-xl bg-card motion-reduce:animate-none" />
      ))}
    </div>
  );
}

export default LibraryManager;
