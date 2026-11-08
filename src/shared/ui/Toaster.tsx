import type { ToasterProps } from "sonner";
import { Toaster as SonnerToaster } from "@/shared/ui/shadcn/sonner.tsx";

// Page padding (6px) + header row (40px) + a gap, so toasts never cover header
// actions. Tests render this too: Sonner's default offset puts a toast's hover
// bridge over the header's primary button, which then blocks clicks on it.
const BELOW_PAGE_HEADER = { top: "56px" };

/** The app's toaster: top-right, below the page header, with a close button. */
export function Toaster(props: ToasterProps) {
  return (
    <SonnerToaster
      position="top-right"
      offset={BELOW_PAGE_HEADER}
      mobileOffset={BELOW_PAGE_HEADER}
      closeButton
      {...props}
    />
  );
}
