import { Toaster as Sonner, type ToasterProps } from "solid-sonner";
import { CircleCheck, Info, LoaderCircle, OctagonX, TriangleAlert } from "lucide";
import { Icon } from "@/shared/ui/Icon.tsx";

const Toaster = (props: ToasterProps) => {
  return (
    <Sonner
      class="toaster group"
      icons={{
        success: <Icon icon={CircleCheck} class="size-4" />,
        info: <Icon icon={Info} class="size-4" />,
        warning: <Icon icon={TriangleAlert} class="size-4" />,
        error: <Icon icon={OctagonX} class="size-4" />,
        loading: <Icon icon={LoaderCircle} class="size-4 animate-spin" />,
      }}
      style={{
        "--normal-bg": "var(--popover)",
        "--normal-text": "var(--popover-foreground)",
        "--normal-border": "var(--border)",
        "--border-radius": "var(--radius)",
      }}
      toastOptions={{
        classes: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
