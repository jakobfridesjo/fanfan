import { useState } from "react";
import { Drawer, DrawerContent, DrawerTitle } from "@/shared/ui/shadcn/drawer.tsx";
import { WordDetails, type WordPanelProps } from "@/pages/reader/ui/WordPanel.tsx";

interface WordDrawerProps extends WordPanelProps {
  onClose: () => void;
}

/**
 * The phone's word panel: a sheet over the bottom of the text that is swiped
 * down to close. It is not modal, so tapping another word swaps its contents.
 */
export function WordDrawer({ onClose, ...panel }: WordDrawerProps) {
  // The word stays selected until the drawer has slid away, so it never empties while closing.
  const [dismissedWord, setDismissedWord] = useState<string | null>(null);
  const { word } = panel;

  return (
    <Drawer
      open={word !== null && word !== dismissedWord}
      onOpenChange={(open) => {
        if (!open) setDismissedWord(word);
      }}
      onOpenChangeComplete={(open) => {
        if (open || word !== dismissedWord) return;
        setDismissedWord(null);
        onClose();
      }}
      modal={false}
      disablePointerDismissal
      showSwipeHandle
    >
      <DrawerContent initialFocus={false} finalFocus={false}>
        {word && (
          <div className="flex flex-col gap-4 overflow-y-auto scroll-fade p-4 pb-[max(--spacing(4),env(safe-area-inset-bottom))]">
            <DrawerTitle className="sr-only" lang="zh">
              {word}
            </DrawerTitle>
            <WordDetails {...panel} word={word} />
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
