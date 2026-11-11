import { useMemo, useState } from "react";
import * as z from "zod/mini";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { open } from "@tauri-apps/plugin-dialog";
import {
  commandErrorMessage,
  commands,
  type DocumentSummary,
  type Folder,
  type ImportStage,
} from "@/shared/api/commands.ts";
import { documentsQuery, foldersQuery } from "@/shared/api/queries.ts";
import { useMessages } from "@/shared/i18n/messages.ts";
import { actionToasts } from "@/shared/lib/toast.ts";
import { useHistoryState } from "@/shared/lib/use-history-state.ts";
import { useQueryErrorToast } from "@/shared/lib/use-query-error-toast.ts";
import { useShelfDrag, type DropTarget } from "@/pages/library/model/use-shelf-drag.ts";

const libraryToast = actionToasts("library-action");

const IMPORT_EXTENSIONS = ["txt", "epub", "pdf"];

/** `stage` is null until Rust reports one, while it loads the dictionary. */
export interface ImportProgress {
  fileName: string | null;
  stage: ImportStage | null;
}

/** Splitting the text into words is most of the wait. */
export function importPercent(stage: ImportStage | null): number {
  switch (stage?.stage) {
    case undefined:
      return 0;
    case "reading":
      return 5;
    case "analyzing":
      return 5 + stage.done * 85;
    case "saving":
      return 90;
  }
}

export type ShelfItem =
  | { kind: "document"; document: DocumentSummary }
  | { kind: "folder"; folder: Folder; documents: DocumentSummary[] };

export type NameDialog =
  | { kind: "createFolder"; documentIds: [number, number] }
  | { kind: "renameFolder"; folder: Folder }
  | { kind: "renameBook"; document: DocumentSummary };

const EMPTY_DOCUMENTS: DocumentSummary[] = [];
const EMPTY_FOLDERS: Folder[] = [];

/** Loose books, and each folder where its newest book would stand. */
function shelfItems(documents: DocumentSummary[], folders: Folder[]): ShelfItem[] {
  const folderById = new Map(folders.map((folder) => [folder.id, folder]));
  const shelved = new Map<number, Extract<ShelfItem, { kind: "folder" }>>();
  const items: ShelfItem[] = [];
  for (const document of documents) {
    const folder = document.folderId === null ? undefined : folderById.get(document.folderId);
    if (!folder) {
      items.push({ kind: "document", document });
      continue;
    }
    const item = shelved.get(folder.id);
    if (item) {
      item.documents.push(document);
    } else {
      const created = { kind: "folder" as const, folder, documents: [document] };
      shelved.set(folder.id, created);
      items.push(created);
    }
  }
  return items;
}

export function useLibraryManager() {
  const m = useMessages();
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [deletingDocument, setDeletingDocument] = useState<DocumentSummary | null>(null);

  const [openFolderId, setOpenFolderId] = useHistoryState(
    "libraryFolder",
    z.nullable(z.number()),
    null
  );
  const [nameDialog, setNameDialog] = useState<NameDialog | null>(null);

  const documents = useQuery(documentsQuery());
  const folders = useQuery(foldersQuery());
  const loadError = documents.error ?? folders.error;
  useQueryErrorToast(loadError ? m.library.loadFailed : null, "documents-query");

  const allDocuments = documents.data ?? EMPTY_DOCUMENTS;
  const allFolders = folders.data ?? EMPTY_FOLDERS;
  // A folder disappears once its last book leaves it.
  const openFolder = allFolders.find((folder) => folder.id === openFolderId) ?? null;
  const items = useMemo(
    () =>
      openFolder
        ? allDocuments
            .filter((document) => document.folderId === openFolder.id)
            .map((document): ShelfItem => ({ kind: "document", document }))
        : shelfItems(allDocuments, allFolders),
    [allDocuments, allFolders, openFolder]
  );

  const refreshShelf = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: documentsQuery().queryKey }),
      queryClient.invalidateQueries({ queryKey: foldersQuery().queryKey }),
    ]);

  const importMutation = useMutation({
    mutationFn: (path: string) =>
      commands.importDocument(path, (stage) =>
        setProgress(
          (current) =>
            current && {
              fileName: stage.stage === "reading" ? stage.fileName : current.fileName,
              stage,
            }
        )
      ),
    onMutate: () => setProgress({ fileName: null, stage: null }),
    onSettled: () => setProgress(null),
    onSuccess: async (document) => {
      await queryClient.invalidateQueries({ queryKey: documentsQuery().queryKey });
      libraryToast.success(m.library.imported(document.title));
    },
    onError: (error) => libraryToast.error(commandErrorMessage(error, m.library.importFailed)),
  });

  const renameBookMutation = useMutation({
    mutationFn: ({ id, title }: { id: number; title: string }) =>
      commands.renameDocument(id, title),
    onSuccess: async () => {
      setNameDialog(null);
      await queryClient.invalidateQueries({ queryKey: documentsQuery().queryKey });
    },
    onError: (error) => libraryToast.error(commandErrorMessage(error, m.library.renameFailed)),
  });

  const deleteMutation = useMutation({
    mutationFn: (document: DocumentSummary) => commands.deleteDocument(document.id),
    onSuccess: async (_result, document) => {
      setDeletingDocument(null);
      await refreshShelf();
      libraryToast.success(m.library.deleted(document.title));
    },
    onError: (error) => libraryToast.error(commandErrorMessage(error, m.library.deleteFailed)),
  });

  const moveMutation = useMutation({
    mutationFn: ({ document, folder }: { document: DocumentSummary; folder: Folder | null }) =>
      commands.moveDocument(document.id, folder?.id ?? null),
    onSuccess: async (_result, { document, folder }) => {
      await refreshShelf();
      if (folder) libraryToast.success(m.library.movedToFolder(document.title, folder.name));
    },
    onError: (error) => libraryToast.error(commandErrorMessage(error, m.library.folderFailed)),
  });

  const createFolderMutation = useMutation({
    mutationFn: ({ name, documentIds }: { name: string; documentIds: number[] }) =>
      commands.createFolder(name, documentIds),
    onSuccess: async () => {
      setNameDialog(null);
      await refreshShelf();
    },
    onError: (error) => libraryToast.error(commandErrorMessage(error, m.library.folderFailed)),
  });

  const renameFolderMutation = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => commands.renameFolder(id, name),
    onSuccess: async () => {
      setNameDialog(null);
      await queryClient.invalidateQueries({ queryKey: foldersQuery().queryKey });
    },
    onError: (error) => libraryToast.error(commandErrorMessage(error, m.library.folderFailed)),
  });

  /** A book dropped on a folder joins it; dropped on a loose book, the two make a new folder. */
  const dropBook = (documentId: number, target: DropTarget) => {
    const document = allDocuments.find((candidate) => candidate.id === documentId);
    if (!document) return;
    if (target.kind === "folder") {
      const folder = allFolders.find((candidate) => candidate.id === target.id);
      if (folder && folder.id !== document.folderId) moveMutation.mutate({ document, folder });
    } else if (!openFolder) {
      setNameDialog({ kind: "createFolder", documentIds: [target.id, documentId] });
    }
  };
  const { drag, dragHandlers } = useShelfDrag(dropBook);

  const submitName = (name: string) => {
    if (nameDialog?.kind === "createFolder") {
      createFolderMutation.mutate({ name, documentIds: nameDialog.documentIds });
    } else if (nameDialog?.kind === "renameFolder") {
      renameFolderMutation.mutate({ id: nameDialog.folder.id, name });
    } else if (nameDialog?.kind === "renameBook") {
      renameBookMutation.mutate({ id: nameDialog.document.id, title: name });
    }
  };

  const chooseFile = async () => {
    const path = await open({
      multiple: false,
      directory: false,
      filters: [{ name: m.library.fileFilter, extensions: IMPORT_EXTENSIONS }],
    });
    if (path) importMutation.mutate(path);
  };

  const confirmDelete = () => {
    if (deletingDocument) deleteMutation.mutate(deletingDocument);
  };

  return {
    documents: allDocuments,
    items,
    loading: documents.isLoading || folders.isLoading,
    importing: importMutation.isPending,
    progress,
    chooseFile,
    deletingDocument,
    setDeletingDocument,
    deleting: deleteMutation.isPending,
    confirmDelete,
    openFolder,
    setOpenFolderId,
    takeOutOfFolder: (document: DocumentSummary) => moveMutation.mutate({ document, folder: null }),
    drag,
    dragHandlers,
    nameDialog,
    setNameDialog,
    submitName,
    savingName:
      createFolderMutation.isPending ||
      renameFolderMutation.isPending ||
      renameBookMutation.isPending,
  };
}
