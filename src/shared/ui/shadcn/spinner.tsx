import { LoaderCircle } from "lucide";
import { cn } from "@/shared/lib/class-names.ts";
import { Icon } from "@/shared/ui/Icon.tsx";

/** A turning circle; `decorative` when text beside it already says what is loading. */
function Spinner(props: { class?: string; decorative?: boolean }) {
  return (
    <Icon
      icon={LoaderCircle}
      data-slot="spinner"
      role={props.decorative ? undefined : "status"}
      label={props.decorative ? undefined : "Loading"}
      class={cn("size-4 animate-spin", props.class)}
    />
  );
}

export { Spinner };
