import { BookOpen, FileUp, Pencil, Plus } from "lucide-react";
import { useMessages } from "@/shared/i18n/messages.ts";
import { ConfirmationDialog } from "@/shared/ui/ConfirmationDialog.tsx";
import { PageHeader } from "@/shared/ui/PageHeader.tsx";
import { TooltipIconButton } from "@/shared/ui/TooltipIconButton.tsx";
import { Button } from "@/shared/ui/shadcn/button.tsx";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/shared/ui/shadcn/empty.tsx";
import { Skeleton } from "@/shared/ui/shadcn/skeleton.tsx";
import { useLibraryManager } from "@/pages/library/model/use-library-manager.ts";
import { DocumentCard } from "@/pages/library/ui/DocumentCard.tsx";
import { FolderCard } from "@/pages/library/ui/FolderCard.tsx";
import { ImportProgressDialog } from "@/pages/library/ui/ImportProgressDialog.tsx";
import { NameDialog } from "@/pages/library/ui/NameDialog.tsx";

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
    nameDialog,
    setNameDialog,
    submitName,
    savingName,
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
            onClick={() => setNameDialog({ kind: "renameFolder", folder: openFolder })}
          >
            <Pencil data-icon="inline-start" />
            {m.common.rename}
          </Button>
        </PageHeader>
      ) : (
        <PageHeader
          title={m.library.title}
          action={
            documents.length > 0 && (
              <TooltipIconButton
                label={m.library.importBook}
                variant="outline"
                size="icon"
                onClick={() => void chooseFile()}
                disabled={importing}
              >
                <Plus />
              </TooltipIconButton>
            )
          }
        />
      )}

      <div className="-m-1 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-1 scroll-fade">
        {loading ? (
          <LibrarySkeleton />
        ) : documents.length === 0 ? (
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
        ) : (
          <div className={SHELF}>
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
                  onRename={() => setNameDialog({ kind: "renameBook", document: item.document })}
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

      {nameDialog && (
        <NameDialog
          dialog={nameDialog}
          saving={savingName}
          onSubmit={submitName}
          onClose={() => setNameDialog(null)}
        />
      )}

      {progress && <ImportProgressDialog progress={progress} />}
    </>
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
