import { useState } from "react";
import { Drawer, DrawerContent, DrawerTitle } from "@/shared/ui/shadcn/drawer.tsx";
import { PanelDetails, type WordPanelProps } from "@/pages/reader/ui/WordPanel.tsx";

interface WordDrawerProps extends WordPanelProps {
  onClose: () => void;
}

/**
 * The phone's word panel: a sheet over the bottom of the text that is swiped
 * down to close. It is not modal, so tapping another word swaps its contents.
 */
export function WordDrawer({ onClose, ...panel }: WordDrawerProps) {
  // The word or passage stays selected until the drawer has slid away, so it never empties while closing.
  const [dismissed, setDismissed] = useState<string | null>(null);
  const subject = panel.word ?? panel.passage?.text ?? null;

  return (
    <Drawer
      open={subject !== null && subject !== dismissed}
      onOpenChange={(open) => {
        if (!open) setDismissed(subject);
      }}
      onOpenChangeComplete={(open) => {
        if (open || subject !== dismissed) return;
        setDismissed(null);
        onClose();
      }}
      modal={false}
      disablePointerDismissal
      showSwipeHandle
    >
      <DrawerContent initialFocus={false} finalFocus={false}>
        {subject && (
          <div className="flex flex-col gap-4 overflow-y-auto scroll-fade p-4 pb-[max(--spacing(4),env(safe-area-inset-bottom))]">
            <DrawerTitle className="sr-only" lang="zh">
              {subject}
            </DrawerTitle>
            <PanelDetails {...panel} />
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
