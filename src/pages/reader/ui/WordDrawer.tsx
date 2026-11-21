import { createSignal, omit, Show } from "solid-js";
import { Drawer, DrawerContent, DrawerTitle } from "@/shared/ui/shadcn/drawer.tsx";
import { PanelDetails, type WordPanelProps } from "@/pages/reader/ui/WordPanel.tsx";

interface WordDrawerProps extends WordPanelProps {
  onClose: () => void;
}

/**
 * The phone's word panel: a sheet over the bottom of the text that is swiped
 * down to close. It is not modal, so tapping another word swaps its contents.
 */
export function WordDrawer(props: WordDrawerProps) {
  const panel = omit(props, "onClose");
  // The word or passage stays selected until the drawer has slid away, so it never empties while closing.
  const [dismissed, setDismissed] = createSignal<string | null>(null);
  const subject = () => props.word ?? props.passage?.text ?? null;

  return (
    <Drawer
      open={subject() !== null && subject() !== dismissed()}
      onOpenChange={(open) => {
        if (!open) setDismissed(subject());
      }}
    >
      <DrawerContent
        onClosed={() => {
          if (subject() !== dismissed()) return;
          setDismissed(null);
          props.onClose();
        }}
      >
        <Show when={subject()}>
          <div class="flex flex-col gap-4 overflow-y-auto scroll-fade p-4 pb-[max(--spacing(4),env(safe-area-inset-bottom))]">
            <DrawerTitle class="sr-only" lang="zh">
              {subject()}
            </DrawerTitle>
            <PanelDetails {...panel} />
          </div>
        </Show>
      </DrawerContent>
    </Drawer>
  );
}
