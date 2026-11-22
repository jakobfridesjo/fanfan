import { createMemo, createSignal } from "solid-js";
import * as z from "zod/mini";
import { useMutation, useQueryClient } from "@tanstack/solid-query";
import { open } from "@tauri-apps/plugin-dialog";
import {
  commandErrorMessage,
  commands,
  type DocumentSummary,
  type Folder,
  type ImportStage,
} from "@/shared/api/commands.ts";
import { documentsQuery, foldersQuery, useCommandQuery } from "@/shared/api/queries.ts";
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

const NO_PROGRESS: ImportProgress = { fileName: null, stage: null };
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
  const [progress, setProgress] = createSignal(NO_PROGRESS);
  const [deletingDocument, setDeletingDocument] = createSignal<DocumentSummary | null>(null);
  /** The book whose audio the prepare dialog is open for. */
  const [preparingAudio, setPreparingAudio] = createSignal<DocumentSummary | null>(null);

  const [openFolderId, setOpenFolderId] = useHistoryState(
    "libraryFolder",
    z.nullable(z.number()),
    null
  );
  const [nameDialog, setNameDialog] = createSignal<NameDialog | null>(null);

  const documents = useCommandQuery(() => documentsQuery());
  const folders = useCommandQuery(() => foldersQuery());
  useQueryErrorToast(
    () => (documents.isError || folders.isError ? m.library.loadFailed : null),
    "documents-query"
  );

  const allDocuments = () => documents.data ?? EMPTY_DOCUMENTS;
  const lastRead = createMemo(() => {
    let latest: DocumentSummary | null = null;
    for (const document of allDocuments()) {
      if (document.readAt !== null && document.readAt > (latest?.readAt ?? 0)) latest = document;
    }
    return latest;
  });
  const allFolders = () => folders.data ?? EMPTY_FOLDERS;
  // A folder disappears once its last book leaves it.
  const openFolder = createMemo(
    () => allFolders().find((folder) => folder.id === openFolderId()) ?? null
  );
  const items = createMemo(() => {
    const folder = openFolder();
    return folder
      ? allDocuments()
          .filter((document) => document.folderId === folder.id)
          .map((document): ShelfItem => ({ kind: "document", document }))
      : shelfItems(allDocuments(), allFolders());
  });

  const refreshShelf = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: documentsQuery().queryKey }),
      queryClient.invalidateQueries({ queryKey: foldersQuery().queryKey }),
    ]);

  const importMutation = useMutation(() => ({
    mutationFn: (path: string) =>
      commands.importDocument(path, (stage) =>
        setProgress((current) => ({
          fileName: stage.stage === "reading" ? stage.fileName : current.fileName,
          stage,
        }))
      ),
    onSettled: () => void setProgress(NO_PROGRESS),
    onSuccess: async (document) => {
      await queryClient.invalidateQueries({ queryKey: documentsQuery().queryKey });
      libraryToast.success(m.library.imported(document.title));
    },
    onError: (error) => libraryToast.error(commandErrorMessage(error, m.library.importFailed)),
  }));

  const renameBookMutation = useMutation(() => ({
    mutationFn: ({ id, title }: { id: number; title: string }) =>
      commands.renameDocument(id, title),
    onSuccess: async () => {
      setNameDialog(null);
      await queryClient.invalidateQueries({ queryKey: documentsQuery().queryKey });
    },
    onError: (error) => libraryToast.error(commandErrorMessage(error, m.library.renameFailed)),
  }));

  const deleteMutation = useMutation(() => ({
    mutationFn: (document: DocumentSummary) => commands.deleteDocument(document.id),
    onSuccess: async (_result, document) => {
      setDeletingDocument(null);
      await refreshShelf();
      libraryToast.success(m.library.deleted(document.title));
    },
    onError: (error) => libraryToast.error(commandErrorMessage(error, m.library.deleteFailed)),
  }));

  const moveMutation = useMutation(() => ({
    mutationFn: ({ document, folder }: { document: DocumentSummary; folder: Folder | null }) =>
      commands.moveDocument(document.id, folder?.id ?? null),
    onSuccess: async (_result, { document, folder }) => {
      await refreshShelf();
      if (folder) libraryToast.success(m.library.movedToFolder(document.title, folder.name));
    },
    onError: (error) => libraryToast.error(commandErrorMessage(error, m.library.folderFailed)),
  }));

  const createFolderMutation = useMutation(() => ({
    mutationFn: ({ name, documentIds }: { name: string; documentIds: number[] }) =>
      commands.createFolder(name, documentIds),
    onSuccess: async () => {
      setNameDialog(null);
      await refreshShelf();
    },
    onError: (error) => libraryToast.error(commandErrorMessage(error, m.library.folderFailed)),
  }));

  const renameFolderMutation = useMutation(() => ({
    mutationFn: ({ id, name }: { id: number; name: string }) => commands.renameFolder(id, name),
    onSuccess: async () => {
      setNameDialog(null);
      await queryClient.invalidateQueries({ queryKey: foldersQuery().queryKey });
    },
    onError: (error) => libraryToast.error(commandErrorMessage(error, m.library.folderFailed)),
  }));

  /** A book dropped on a folder joins it; dropped on a loose book, the two make a new folder. */
  const dropBook = (documentId: number, target: DropTarget) => {
    const document = allDocuments().find((candidate) => candidate.id === documentId);
    if (!document) return;
    if (target.kind === "folder") {
      const folder = allFolders().find((candidate) => candidate.id === target.id);
      if (folder && folder.id !== document.folderId) void moveMutation.mutate({ document, folder });
    } else if (!openFolder()) {
      setNameDialog({ kind: "createFolder", documentIds: [target.id, documentId] });
    }
  };
  const { drag, dragHandlers } = useShelfDrag(dropBook);

  const submitName = (name: string) => {
    const dialog = nameDialog();
    if (dialog?.kind === "createFolder") {
      void createFolderMutation.mutate({ name, documentIds: dialog.documentIds });
    } else if (dialog?.kind === "renameFolder") {
      void renameFolderMutation.mutate({ id: dialog.folder.id, name });
    } else if (dialog?.kind === "renameBook") {
      void renameBookMutation.mutate({ id: dialog.document.id, title: name });
    }
  };

  const chooseFile = async () => {
    const path = await open({
      multiple: false,
      directory: false,
      filters: [{ name: m.library.fileFilter, extensions: IMPORT_EXTENSIONS }],
    });
    if (path) void importMutation.mutate(path);
  };

  const confirmDelete = () => {
    const document = deletingDocument();
    if (document) void deleteMutation.mutate(document);
  };

  return {
    get documents() {
      return allDocuments();
    },
    get items() {
      return items();
    },
    /** The book read most recently, to pick up where it was left. */
    get lastRead() {
      return lastRead();
    },
    get loading() {
      return documents.isLoading || folders.isLoading;
    },
    get importing() {
      return importMutation.isPending;
    },
    /** Set while a book imports: the mutation's own writes land only once it settles. */
    get progress() {
      return importMutation.isPending ? progress() : null;
    },
    chooseFile,
    get deletingDocument() {
      return deletingDocument();
    },
    setDeletingDocument: (document: DocumentSummary | null) => void setDeletingDocument(document),
    get preparingAudio() {
      return preparingAudio();
    },
    setPreparingAudio: (document: DocumentSummary | null) => void setPreparingAudio(document),
    get deleting() {
      return deleteMutation.isPending;
    },
    confirmDelete,
    get openFolder() {
      return openFolder();
    },
    setOpenFolderId,
    takeOutOfFolder: (document: DocumentSummary) =>
      void moveMutation.mutate({ document, folder: null }),
    get drag() {
      return drag();
    },
    dragHandlers,
    get nameDialog() {
      return nameDialog();
    },
    setNameDialog: (dialog: NameDialog | null) => void setNameDialog(dialog),
    submitName,
    get savingName() {
      return (
        createFolderMutation.isPending ||
        renameFolderMutation.isPending ||
        renameBookMutation.isPending
      );
    },
  };
}
