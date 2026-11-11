import { page as screen } from "vitest/browser";
import { describe, expect, it } from "vitest";
import type { DocumentSummary, Folder } from "@/shared/api/commands.ts";
import { deferred } from "@/shared/test/deferred.ts";
import { dragOnto } from "@/shared/test/pointer.ts";
import { makeDocument } from "@/shared/test/fixtures.ts";
import { renderPageInRouter } from "@/shared/test/render.tsx";
import { callsTo, mockCommands, sendToChannel } from "@/shared/test/tauri.ts";
import LibraryManager from "@/pages/library/ui/LibraryManager.tsx";

describe("LibraryManager", () => {
  it("invites an import while the library is empty", async () => {
    mockCommands({ list_documents: () => [], list_folders: () => [] });
    await renderPageInRouter(<LibraryManager />);

    await expect.element(screen.getByText("No books yet")).toBeVisible();
    await expect.element(screen.getByRole("button", { name: "Import book" })).toBeVisible();
  });

  it("shelves books as covers that open the reader, with a link that opens the deck", async () => {
    const calls = mockCommands({
      list_documents: () => [
        makeDocument({
          id: 3,
          title: "三体",
          totalTokens: 1000,
          knownTokens: 812,
          learningTokens: 55,
          uniqueWords: 2400,
          unseenWords: 1300,
        }),
        makeDocument({ id: 5, title: "活着", hasCover: true }),
      ],
      get_cover: () => "data:image/png;base64,iVBORw0KGgo=",
      list_folders: () => [],
    });
    const { container } = await renderPageInRouter(<LibraryManager />);

    const book = screen.getByRole("link", { name: "Read 三体" });
    await expect.element(book).toHaveAttribute("href", "/read/3");
    // Without a cover image, the title is the cover.
    await expect.element(book.getByText("三体")).toBeVisible();
    await expect
      .element(book)
      .toHaveAttribute("title", expect.stringContaining("1,300 of 2,400 words to sort"));
    await expect
      .element(book.getByRole("meter", { name: "Known words" }))
      .toHaveAttribute("aria-valuetext", "81% known, 5% learning");

    await expect
      .element(screen.getByRole("link", { name: "Study 三体" }))
      .toHaveAttribute("href", "/library/3");

    await expect
      .poll(() => container.querySelector("img")?.getAttribute("src"))
      .toBe("data:image/png;base64,iVBORw0KGgo=");
    expect(callsTo(calls, "get_cover")).toEqual([{ documentId: 5 }]);
    await expect.element(screen.getByRole("button", { name: "Import book" })).toBeVisible();
  });

  it("opens a book in the reader", async () => {
    mockCommands({
      list_documents: () => [makeDocument({ id: 3, title: "三体" })],
      list_folders: () => [],
    });
    const { router } = await renderPageInRouter(<LibraryManager />);

    await screen.getByRole("link", { name: "Read 三体" }).click();
    await expect.poll(() => router.state.location.pathname).toBe("/read/3");
  });

  it("studies a book's words from the link below its cover", async () => {
    mockCommands({
      list_documents: () => [makeDocument({ id: 3, title: "三体" })],
      list_folders: () => [],
    });
    const { router } = await renderPageInRouter(<LibraryManager />);

    await screen.getByRole("link", { name: "Study 三体" }).click();
    await expect.poll(() => router.state.location.pathname).toBe("/library/3");
  });

  it("imports a chosen file, reports progress, then shelves the new book", async () => {
    const result = deferred<DocumentSummary>();
    let documents: DocumentSummary[] = [];
    let progress: unknown;
    const calls = mockCommands({
      list_documents: () => documents,
      list_folders: () => [],
      "plugin:dialog|open": () => "/home/me/books/西游记.epub",
      import_document: ({ onProgress }) => {
        progress = onProgress;
        return result.promise;
      },
    });
    const { router } = await renderPageInRouter(<LibraryManager />);

    await screen.getByRole("button", { name: "Import book" }).click();
    const dialog = screen.getByRole("dialog", { name: "Importing Book" });
    await expect.element(dialog.getByText("Loading the dictionary…")).toBeVisible();
    await expect.element(dialog.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");

    // On Android the picked path is a content:// URI; Rust names the file.
    sendToChannel(
      progress,
      { stage: "reading", fileName: "西游记.epub" },
      { stage: "analyzing", done: 0.5 }
    );
    await expect.element(dialog.getByText("西游记.epub")).toBeVisible();
    await expect.element(dialog.getByText("Splitting the text into words…")).toBeVisible();
    await expect.element(dialog.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "47.5");

    const imported = makeDocument({ id: 9, title: "西游记" });
    documents = [imported];
    result.resolve(imported);

    await expect.element(screen.getByText("Imported “西游记”")).toBeVisible();
    await expect.element(dialog).not.toBeInTheDocument();
    await expect.element(screen.getByRole("link", { name: "Read 西游记" })).toBeVisible();
    expect(router.state.location.pathname).toBe("/");
    expect(callsTo(calls, "import_document")[0]?.path).toBe("/home/me/books/西游记.epub");
  });

  it("does nothing when the file dialog is cancelled", async () => {
    const calls = mockCommands({
      list_documents: () => [],
      list_folders: () => [],
      "plugin:dialog|open": () => null,
    });
    await renderPageInRouter(<LibraryManager />);

    await screen.getByRole("button", { name: "Import book" }).click();
    await expect.element(screen.getByText("No books yet")).toBeVisible();
    expect(callsTo(calls, "import_document")).toEqual([]);
  });

  it("shows why an import failed", async () => {
    mockCommands({
      list_documents: () => [],
      list_folders: () => [],
      "plugin:dialog|open": () => "/tmp/english.txt",
      import_document: () => Promise.reject(new Error("The file contains no Chinese text")),
    });
    await renderPageInRouter(<LibraryManager />);

    await screen.getByRole("button", { name: "Import book" }).click();
    await expect.element(screen.getByText("The file contains no Chinese text")).toBeVisible();
    await expect.element(screen.getByText("No books yet")).toBeVisible();
  });

  it("deletes a book after confirmation", async () => {
    let documents = [makeDocument({ id: 4, title: "活着" })];
    const calls = mockCommands({
      list_documents: () => documents,
      list_folders: () => [],
      delete_document: () => {
        documents = [];
        return null;
      },
    });
    await renderPageInRouter(<LibraryManager />);

    await screen.getByRole("button", { name: "Actions for 活着" }).click();
    await screen.getByRole("menuitem", { name: "Delete" }).click();
    await expect.element(screen.getByText(/Words you know or are learning stay/)).toBeVisible();
    await screen.getByRole("button", { name: "Delete", exact: true }).click();

    await expect.element(screen.getByText("Deleted “活着”")).toBeVisible();
    await expect.element(screen.getByText("No books yet")).toBeVisible();
    expect(callsTo(calls, "delete_document")).toEqual([{ id: 4 }]);
  });

  it("renames a book from its menu", async () => {
    const titles = new Map([[4, "1000"]]);
    const calls = mockCommands({
      list_documents: () => [...titles].map(([id, title]) => makeDocument({ id, title })),
      list_folders: () => [],
      rename_document: ({ id, title }) => {
        titles.set(Number(id), String(title));
        return null;
      },
    });
    await renderPageInRouter(<LibraryManager />);

    await screen.getByRole("button", { name: "Actions for 1000" }).click();
    await screen.getByRole("menuitem", { name: "Rename" }).click();
    const dialog = screen.getByRole("dialog", { name: "Rename Book" });
    const title = dialog.getByRole("textbox", { name: "Title" });
    await expect.element(title).toHaveValue("1000");

    await title.fill(" ");
    await dialog.getByRole("button", { name: "Rename" }).click();
    await expect.element(dialog.getByText("Required")).toBeVisible();
    expect(callsTo(calls, "rename_document")).toEqual([]);

    await title.fill("活着");
    await dialog.getByRole("button", { name: "Rename" }).click();
    await expect.element(dialog).not.toBeInTheDocument();
    await expect.element(screen.getByRole("link", { name: "Read 活着" })).toBeVisible();
    expect(callsTo(calls, "rename_document")).toEqual([{ id: 4, title: "活着" }]);
  });

  it("keeps the dialog open with the old title when renaming fails", async () => {
    mockCommands({
      list_documents: () => [makeDocument({ id: 4, title: "1000" })],
      list_folders: () => [],
      rename_document: () => Promise.reject(new Error("Document 4 does not exist")),
    });
    await renderPageInRouter(<LibraryManager />);

    await screen.getByRole("button", { name: "Actions for 1000" }).click();
    await screen.getByRole("menuitem", { name: "Rename" }).click();
    const dialog = screen.getByRole("dialog", { name: "Rename Book" });
    await dialog.getByRole("textbox", { name: "Title" }).fill("活着");
    await dialog.getByRole("button", { name: "Rename" }).click();

    await expect.element(screen.getByText("Document 4 does not exist")).toBeVisible();
    await expect.element(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect.element(screen.getByRole("link", { name: "Read 1000" })).toBeVisible();
  });

  it("keeps the book when the deletion is cancelled", async () => {
    const calls = mockCommands({
      list_documents: () => [makeDocument({ title: "活着" })],
      list_folders: () => [],
    });
    await renderPageInRouter(<LibraryManager />);

    await screen.getByRole("button", { name: "Actions for 活着" }).click();
    await screen.getByRole("menuitem", { name: "Delete" }).click();
    await screen.getByRole("button", { name: "Cancel" }).click();

    await expect.element(screen.getByRole("alertdialog")).not.toBeInTheDocument();
    await expect.element(screen.getByText("活着")).toBeVisible();
    expect(callsTo(calls, "delete_document")).toEqual([]);
  });

  it("keeps the book when deleting fails", async () => {
    mockCommands({
      list_documents: () => [makeDocument({ id: 4, title: "活着" })],
      list_folders: () => [],
      delete_document: () => Promise.reject(new Error("Document 4 does not exist")),
    });
    await renderPageInRouter(<LibraryManager />);

    await screen.getByRole("button", { name: "Actions for 活着" }).click();
    await screen.getByRole("menuitem", { name: "Delete" }).click();
    await screen.getByRole("button", { name: "Delete", exact: true }).click();

    await expect.element(screen.getByText("Document 4 does not exist")).toBeVisible();
    await expect.element(screen.getByText("活着")).toBeVisible();
  });

  it("says when the library cannot be loaded", async () => {
    mockCommands({
      list_documents: () => Promise.reject(new Error("Database error")),
      list_folders: () => [],
    });
    await renderPageInRouter(<LibraryManager />);

    await expect.element(screen.getByText("Failed to load your library")).toBeVisible();
  });

  describe("folders", () => {
    /** Rust's folder rules over an in-memory shelf. */
    function mockShelf(documents: DocumentSummary[], folders: Folder[] = []) {
      let nextId = 100;
      const dropEmpty = () => {
        folders = folders.filter((folder) => documents.some((d) => d.folderId === folder.id));
      };
      const moveTo = (ids: number[], folderId: number | null) => {
        documents = documents.map((d) => (ids.includes(d.id) ? { ...d, folderId } : d));
        dropEmpty();
      };
      return mockCommands({
        list_documents: () => documents,
        list_folders: () => folders,
        get_cover: () => null,
        create_folder: ({ name, documentIds }) => {
          const folder = { id: nextId++, name: name as string };
          folders = [folder, ...folders];
          moveTo(documentIds as number[], folder.id);
          return folder;
        },
        rename_folder: ({ id, name }) => {
          folders = folders.map((f) => (f.id === id ? { ...f, name: name as string } : f));
          return null;
        },
        move_document: ({ documentId, folderId }) => {
          moveTo([documentId as number], folderId as number | null);
          return null;
        },
      });
    }

    it("makes a named folder when a book is dropped on another", async () => {
      const calls = mockShelf([
        makeDocument({ id: 1, title: "三体" }),
        makeDocument({ id: 2, title: "活着" }),
      ]);
      const { router } = await renderPageInRouter(<LibraryManager />);

      await dragOnto(
        screen.getByRole("link", { name: "Read 活着" }).element(),
        screen.getByRole("link", { name: "Read 三体" }).element()
      );
      const dialog = screen.getByRole("dialog", { name: "New Folder" });
      await expect.element(dialog).toBeVisible();
      expect(router.state.location.pathname).toBe("/");

      await dialog.getByRole("textbox", { name: "Name" }).fill("  小说 ");
      await dialog.getByRole("button", { name: "Create" }).click();

      const folder = screen.getByRole("button", { name: "Open folder 小说, 2 books" });
      await expect.element(folder).toBeVisible();
      await expect.element(screen.getByRole("link", { name: "Read 三体" })).not.toBeInTheDocument();
      expect(callsTo(calls, "create_folder")).toEqual([{ name: "小说", documentIds: [1, 2] }]);
    });

    it("drags a book by touch only after a hold, so a swipe scrolls instead", async () => {
      mockShelf([makeDocument({ id: 1, title: "三体" }), makeDocument({ id: 2, title: "活着" })]);
      await renderPageInRouter(<LibraryManager />);
      const dragged = screen.getByRole("link", { name: "Read 活着" }).element();
      const target = screen.getByRole("link", { name: "Read 三体" }).element();

      await dragOnto(dragged, target, { pointerType: "touch" });
      await expect
        .element(screen.getByRole("dialog", { name: "New Folder" }))
        .not.toBeInTheDocument();

      await dragOnto(dragged, target, { pointerType: "touch", holdMs: 600 });
      await expect.element(screen.getByRole("dialog", { name: "New Folder" })).toBeVisible();
    });

    it("needs a name and makes no folder when cancelled", async () => {
      const calls = mockShelf([
        makeDocument({ id: 1, title: "三体" }),
        makeDocument({ id: 2, title: "活着" }),
      ]);
      await renderPageInRouter(<LibraryManager />);

      await dragOnto(
        screen.getByRole("link", { name: "Read 活着" }).element(),
        screen.getByRole("link", { name: "Read 三体" }).element()
      );
      const dialog = screen.getByRole("dialog", { name: "New Folder" });
      await dialog.getByRole("button", { name: "Create" }).click();
      await expect.element(dialog.getByText("Required")).toBeVisible();

      await dialog.getByRole("button", { name: "Cancel" }).click();
      await expect.element(dialog).not.toBeInTheDocument();
      await expect.element(screen.getByRole("link", { name: "Read 活着" })).toBeVisible();
      expect(callsTo(calls, "create_folder")).toEqual([]);
    });

    it("moves a book dropped on a folder into it", async () => {
      const calls = mockShelf(
        [
          makeDocument({ id: 1, title: "三体", folderId: 7 }),
          makeDocument({ id: 2, title: "活着", folderId: 7 }),
          makeDocument({ id: 3, title: "围城" }),
        ],
        [{ id: 7, name: "小说" }]
      );
      await renderPageInRouter(<LibraryManager />);

      await dragOnto(
        screen.getByRole("link", { name: "Read 围城" }).element(),
        screen.getByRole("button", { name: "Open folder 小说, 2 books" }).element()
      );

      await expect.element(screen.getByText("Moved “围城” to “小说”")).toBeVisible();
      await expect
        .element(screen.getByRole("button", { name: "Open folder 小说, 3 books" }))
        .toBeVisible();
      expect(callsTo(calls, "move_document")).toEqual([{ documentId: 3, folderId: 7 }]);
    });

    it("opens a folder to rename it and take books out", async () => {
      const calls = mockShelf(
        [
          makeDocument({ id: 1, title: "三体", folderId: 7 }),
          makeDocument({ id: 2, title: "活着", folderId: 7 }),
          makeDocument({ id: 3, title: "围城" }),
        ],
        [{ id: 7, name: "小说" }]
      );
      await renderPageInRouter(<LibraryManager />);

      await screen.getByRole("button", { name: "Open folder 小说, 2 books" }).click();
      await expect.element(screen.getByRole("link", { name: "Read 三体" })).toBeVisible();
      await expect.element(screen.getByRole("link", { name: "Read 围城" })).not.toBeInTheDocument();
      await expect
        .element(screen.getByRole("button", { name: "Import book" }))
        .not.toBeInTheDocument();

      await screen.getByRole("button", { name: "Rename folder" }).click();
      const dialog = screen.getByRole("dialog", { name: "Rename Folder" });
      await expect.element(dialog.getByRole("textbox", { name: "Name" })).toHaveValue("小说");
      await dialog.getByRole("textbox", { name: "Name" }).fill("科幻");
      await dialog.getByRole("button", { name: "Rename" }).click();
      await expect.element(screen.getByText("科幻")).toBeVisible();
      expect(callsTo(calls, "rename_folder")).toEqual([{ id: 7, name: "科幻" }]);

      await screen.getByRole("button", { name: "Actions for 三体" }).click();
      await screen.getByRole("menuitem", { name: "Take out of folder" }).click();
      await expect.element(screen.getByRole("link", { name: "Read 三体" })).not.toBeInTheDocument();

      // Taking out the last book empties the folder, which leaves the shelf with loose books.
      await screen.getByRole("button", { name: "Actions for 活着" }).click();
      await screen.getByRole("menuitem", { name: "Take out of folder" }).click();
      await expect.element(screen.getByRole("link", { name: "Read 围城" })).toBeVisible();
      await expect.element(screen.getByRole("link", { name: "Read 三体" })).toBeVisible();
      expect(callsTo(calls, "move_document")).toEqual([
        { documentId: 1, folderId: null },
        { documentId: 2, folderId: null },
      ]);
    });

    it("goes back to the shelf from a folder", async () => {
      mockShelf(
        [
          makeDocument({ id: 1, title: "三体", folderId: 7 }),
          makeDocument({ id: 2, title: "活着", folderId: 7 }),
        ],
        [{ id: 7, name: "小说" }]
      );
      await renderPageInRouter(<LibraryManager />);

      await screen.getByRole("button", { name: "Open folder 小说, 2 books" }).click();
      await screen.getByRole("button", { name: "Back to library" }).click();
      await expect
        .element(screen.getByRole("button", { name: "Open folder 小说, 2 books" }))
        .toBeVisible();
    });
  });
});
