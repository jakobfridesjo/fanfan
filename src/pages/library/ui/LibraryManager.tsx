import { BookOpen, FileUp, Pencil, Plus } from "lucide";
import { For, Match, Show, Switch } from "solid-js";
import { useMessages } from "@/shared/i18n/messages.ts";
import { ConfirmationDialog } from "@/shared/ui/ConfirmationDialog.tsx";
import { Icon } from "@/shared/ui/Icon.tsx";
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
import { useLibraryManager, type ShelfItem } from "@/pages/library/model/use-library-manager.ts";
import { ContinueReadingCard } from "@/pages/library/ui/ContinueReadingCard.tsx";
import { DocumentCard } from "@/pages/library/ui/DocumentCard.tsx";
import { FolderCard } from "@/pages/library/ui/FolderCard.tsx";
import { ImportProgressDialog } from "@/pages/library/ui/ImportProgressDialog.tsx";
import { NameDialog } from "@/pages/library/ui/NameDialog.tsx";

/** Covers as posters, as many to a row as fit. */
const SHELF = "grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-4";

function LibraryManager() {
  const m = useMessages();
  const library = useLibraryManager();
  const landing = (kind: "document" | "folder", id: number) =>
    library.drag?.over?.kind === kind && library.drag.over.id === id;

  return (
    <>
      <Show
        when={library.openFolder}
        fallback={
          <PageHeader
            title={m.library.title}
            action={
              <Show when={library.documents.length > 0}>
                <TooltipIconButton
                  label={m.library.importBook}
                  variant="outline"
                  size="icon"
                  onClick={() => void library.chooseFile()}
                  disabled={library.importing}
                >
                  <Icon icon={Plus} />
                </TooltipIconButton>
              </Show>
            }
          />
        }
      >
        {(folder) => (
          <PageHeader
            title={<span lang="zh">{folder().name}</span>}
            onBack={() => library.setOpenFolderId(null)}
            backLabel={m.deck.backToLibrary}
          >
            <Button
              variant="outline"
              aria-label={m.library.renameFolderLabel}
              onClick={() => library.setNameDialog({ kind: "renameFolder", folder: folder() })}
            >
              <Icon icon={Pencil} data-icon="inline-start" />
              {m.common.rename}
            </Button>
          </PageHeader>
        )}
      </Show>

      <div class="-m-1 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-1 scroll-fade">
        <Switch>
          <Match when={library.loading}>
            <LibrarySkeleton />
          </Match>
          <Match when={library.documents.length === 0}>
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Icon icon={BookOpen} />
                </EmptyMedia>
                <EmptyTitle>{m.library.emptyTitle}</EmptyTitle>
                <EmptyDescription>{m.library.emptyDescription}</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button onClick={() => void library.chooseFile()} disabled={library.importing}>
                  <Icon icon={FileUp} data-icon="inline-start" />
                  {m.library.importBook}
                </Button>
              </EmptyContent>
            </Empty>
          </Match>
          <Match when={true}>
            <Show when={!library.openFolder && library.lastRead}>
              {(document) => <ContinueReadingCard document={document()} />}
            </Show>
            <div class={SHELF}>
              <For each={library.items} keyed={itemKey}>
                {(item) => (
                  <Switch>
                    <Match when={folderItem(item())}>
                      {(shelved) => (
                        <FolderCard
                          folder={shelved().folder}
                          documents={shelved().documents}
                          landing={landing("folder", shelved().folder.id)}
                          onOpen={() => library.setOpenFolderId(shelved().folder.id)}
                        />
                      )}
                    </Match>
                    <Match when={documentItem(item())}>
                      {(loose) => (
                        <DocumentCard
                          document={loose().document}
                          drag={
                            library.drag?.documentId === loose().document.id ? library.drag : null
                          }
                          dragHandlers={library.dragHandlers(loose().document.id)}
                          acceptsDrop={!library.openFolder}
                          landing={landing("document", loose().document.id)}
                          onRename={() =>
                            library.setNameDialog({
                              kind: "renameBook",
                              document: loose().document,
                            })
                          }
                          onDelete={() => library.setDeletingDocument(loose().document)}
                          onTakeOut={
                            library.openFolder
                              ? () => library.takeOutOfFolder(loose().document)
                              : undefined
                          }
                        />
                      )}
                    </Match>
                  </Switch>
                )}
              </For>
            </div>
          </Match>
        </Switch>
      </div>

      <ConfirmationDialog
        open={library.deletingDocument !== null}
        onClose={() => library.setDeletingDocument(null)}
        onConfirm={library.confirmDelete}
        confirmLabel={m.common.delete}
        destructive
        loading={library.deleting}
        title={m.library.deleteTitle}
        message={m.library.deleteMessage(library.deletingDocument?.title ?? "")}
      />

      <Show when={library.nameDialog} keyed>
        {(dialog) => (
          <NameDialog
            dialog={dialog}
            saving={library.savingName}
            onSubmit={library.submitName}
            onClose={() => library.setNameDialog(null)}
          />
        )}
      </Show>

      <Show when={library.progress}>
        {(progress) => <ImportProgressDialog progress={progress()} />}
      </Show>
    </>
  );
}

const itemKey = (item: ShelfItem) =>
  item.kind === "folder" ? `folder-${item.folder.id}` : `${item.document.id}`;
const folderItem = (item: ShelfItem) => (item.kind === "folder" ? item : null);
const documentItem = (item: ShelfItem) => (item.kind === "document" ? item : null);

function LibrarySkeleton() {
  return (
    <div class={SHELF} aria-hidden="true">
      <For each={["first", "second", "third", "fourth"]}>
        {() => <Skeleton class="aspect-2/3 rounded-xl bg-card motion-reduce:animate-none" />}
      </For>
    </div>
  );
}

export default LibraryManager;
