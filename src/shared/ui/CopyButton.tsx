import { Check, Copy } from "lucide-react";
import { TooltipIconButton } from "@/shared/ui/TooltipIconButton.tsx";
import { useCopyToClipboard } from "@/shared/lib/use-copy-to-clipboard.ts";
import { cn } from "@/shared/lib/class-names.ts";

interface CopyButtonProps {
  text: string;
  label: string;
  className?: string;
}

export function CopyButton({ text, label, className }: CopyButtonProps) {
  const { copied, copy } = useCopyToClipboard();

  return (
    <TooltipIconButton
      label={label}
      tooltip={copied ? "Copied!" : label}
      variant="ghost"
      size="icon-xs"
      className={cn("text-muted-foreground hover:text-foreground", className)}
      disabled={text.length === 0}
      onClick={() => void copy(text)}
    >
      {copied ? <Check className="text-success" /> : <Copy />}
    </TooltipIconButton>
  );
}
