import { useEffect, useRef, useState } from "react";

const COPIED_RESET_MS = 2000;

export function useCopyToClipboard(resetAfterMs: number = COPIED_RESET_MS) {
  const [copied, setCopied] = useState(false);
  const timeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timeout.current), []);

  const copy = async (text: string): Promise<boolean> => {
    if (!navigator.clipboard) return false;

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return false;
    }

    setCopied(true);
    clearTimeout(timeout.current);
    timeout.current = setTimeout(() => setCopied(false), resetAfterMs);
    return true;
  };

  return { copied, copy };
}
