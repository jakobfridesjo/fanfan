import { Bookmark as BookmarkIcon, BookmarkCheck, BookmarkMinus, BookmarkPlus, X } from "lucide";
import { createSignal, For, Show } from "solid-js";
import type { Bookmark } from "@/shared/api/commands.ts";
import { useMessages } from "@/shared/i18n/messages.ts";
import { Icon } from "@/shared/ui/Icon.tsx";
import { Button } from "@/shared/ui/shadcn/button.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/shadcn/popover.tsx";

interface BookmarksMenuProps {
  bookmarks: Bookmark[];
  /** Whether the paragraph at the top of the view is bookmarked. */
  bookmarked: boolean;
  saving: boolean;
  disabled: boolean;
  sectionTitle: (position: number) => string;
  onToggle: () => void;
  onGo: (bookmark: Bookmark) => void;
  onDelete: (bookmark: Bookmark) => void;
}

/** Bookmarks the place in view, and lists the book's bookmarks to jump back to. */
export function BookmarksMenu(props: BookmarksMenuProps) {
  const m = useMessages();
  const [open, setOpen] = createSignal(false);
  const place = (bookmark: Bookmark) =>
    bookmark.sectionTitle ?? props.sectionTitle(bookmark.section);

  return (
    <Popover open={open()} onOpenChange={setOpen} placement="bottom-end">
      <PopoverTrigger
        as={Button}
        variant="outline"
        size="icon"
        aria-label={m.reader.bookmarks}
        disabled={props.disabled}
      >
        <Show when={props.bookmarked} fallback={<Icon icon={BookmarkIcon} />}>
          <Icon icon={BookmarkCheck} />
        </Show>
      </PopoverTrigger>
      <PopoverContent class="w-80 gap-3">
        <Button
          variant={props.bookmarked ? "outline" : "default"}
          disabled={props.saving}
          onClick={() => props.onToggle()}
        >
          <Icon icon={props.bookmarked ? BookmarkMinus : BookmarkPlus} data-icon="inline-start" />
          {props.bookmarked ? m.reader.removeBookmarkHere : m.reader.bookmarkHere}
        </Button>
        <Show
          when={props.bookmarks.length > 0}
          fallback={<p class="text-muted-foreground">{m.reader.noBookmarks}</p>}
        >
          <ul aria-label={m.reader.bookmarks} class="-mx-2 flex max-h-80 flex-col overflow-y-auto">
            <For each={props.bookmarks} keyed={(bookmark) => bookmark.id}>
              {(bookmark) => (
                <li class="flex items-start gap-1">
                  <button
                    type="button"
                    aria-label={m.reader.goToBookmark(place(bookmark()))}
                    class="flex min-w-0 flex-1 flex-col rounded-lg px-2 py-1.5 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-hidden"
                    onClick={() => {
                      setOpen(false);
                      props.onGo(bookmark());
                    }}
                  >
                    <span lang="zh" class="truncate font-medium">
                      {place(bookmark())}
                    </span>
                    <span lang="zh" class="line-clamp-2 text-muted-foreground">
                      {bookmark().excerpt}
                    </span>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    class="mt-1 text-muted-foreground"
                    aria-label={m.reader.deleteBookmark(place(bookmark()))}
                    onClick={() => props.onDelete(bookmark())}
                  >
                    <Icon icon={X} />
                  </Button>
                </li>
              )}
            </For>
          </ul>
        </Show>
      </PopoverContent>
    </Popover>
  );
}
