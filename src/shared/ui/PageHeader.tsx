import type { JSX } from "@solidjs/web";
import { children, createEffect, createSignal, Show } from "solid-js";
import { ArrowLeft, Ellipsis } from "lucide";

import { Button } from "@/shared/ui/shadcn/button.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/shared/ui/shadcn/dropdown-menu.tsx";
import { Icon } from "@/shared/ui/Icon.tsx";
import { TooltipIconButton } from "@/shared/ui/TooltipIconButton.tsx";
import { useIsMobile } from "@/shared/lib/use-mobile.ts";
import { useMessages } from "@/shared/i18n/messages.ts";

interface PageHeaderProps {
  title: JSX.Element;
  /** Renders a back arrow to the left of the title. */
  onBack?: () => void;
  backLabel?: string;
  /** Centered between the title and the actions, e.g. a search box; below the title on phones. */
  center?: JSX.Element;
  /** Keeps `center` in the row on phones too: for a compact picker, not a search box. */
  centerInline?: boolean;
  /** The page's main action: stays beside the title on phones instead of folding into the menu. */
  action?: JSX.Element;
  children?: JSX.Element;
}

function ActionsMenu(props: { children: JSX.Element }) {
  const m = useMessages();
  return (
    <DropdownMenu placement="bottom-end">
      <DropdownMenuTrigger as={Button} variant="ghost" size="icon" class="ml-auto">
        <Icon icon={Ellipsis} class="size-5" />
        <span class="sr-only">{m.common.actions}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent class="w-auto">
        <div class="flex min-w-max flex-col gap-1 p-1 [&>div]:w-full [&>div]:flex-col! [&>div]:items-stretch! [&>div]:gap-1 **:[[role=group]]:flex-col! **:[[role=group]]:items-stretch! **:[[role=group]]:gap-1 **:[[role=group]>*]:rounded-m! **:[[role=group]>*]:border! **:data-[slot=button]:justify-start">
          {props.children}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function PageHeader(props: PageHeaderProps) {
  const m = useMessages();
  const isMobile = useIsMobile();
  const actions = children(() => props.children);
  const hasActions = () => actions.toArray().length > 0;
  const centered = () => Boolean(props.center) && (props.centerInline || !isMobile());

  let row: HTMLDivElement | undefined;
  let title: HTMLDivElement | undefined;
  let center: HTMLDivElement | undefined;
  let inlineActions: HTMLDivElement | undefined;
  // Remembered while the actions are inline, so once collapsed they expand again as soon as there is room.
  let actionsWidth = 0;
  const [fits, setFits] = createSignal(true);
  const collapsed = () => isMobile() || !fits();

  createEffect(
    () => [hasActions() && !isMobile(), fits(), centered()] as const,
    ([measuring]) => {
      if (!measuring || !row || !title) return;
      const [rowElement, titleElement] = [row, title];
      const shown = (element: HTMLDivElement | undefined) =>
        element?.isConnected ? element : undefined;

      const measure = () => {
        const actionsElement = shown(inlineActions);
        if (actionsElement) actionsWidth = actionsElement.offsetWidth;
        const gap = Number.parseFloat(getComputedStyle(rowElement).columnGap) || 0;
        const centerElement = shown(center);
        const room = centerElement
          ? (rowElement.clientWidth - centerElement.offsetWidth) / 2 - gap
          : rowElement.clientWidth - titleElement.offsetWidth - gap;
        setFits(actionsWidth <= room);
      };

      measure();
      const observer = new ResizeObserver(measure);
      for (const element of [rowElement, titleElement, shown(center), shown(inlineActions)])
        if (element) observer.observe(element);
      return () => observer.disconnect();
    }
  );

  return (
    <div class="mb-1.5 flex shrink-0 flex-col gap-3 sm:min-h-10 sm:justify-center">
      <div
        ref={(element) => (row = element)}
        class={[
          "flex min-h-10 items-center justify-between gap-3",
          { "grid grid-cols-[1fr_auto_1fr]": centered() },
        ]}
      >
        <div ref={(element) => (title = element)} class="flex min-w-0 items-center gap-2">
          <Show when={props.onBack}>
            <TooltipIconButton
              label={props.backLabel ?? m.common.back}
              variant="ghost"
              size="icon"
              onClick={() => props.onBack?.()}
            >
              <Icon icon={ArrowLeft} />
            </TooltipIconButton>
          </Show>
          <div class="min-w-0 text-lg font-medium">{props.title}</div>
        </div>
        <Show when={centered()}>
          <div ref={(element) => (center = element)} class="flex items-center gap-2">
            {props.center}
          </div>
        </Show>
        <Show when={hasActions() || props.action}>
          <div class="flex min-w-0 items-center justify-end gap-2">
            <Show when={hasActions()}>
              <Show
                when={collapsed()}
                fallback={
                  <div
                    ref={(element) => (inlineActions = element)}
                    class="flex w-max shrink-0 items-center gap-2"
                  >
                    {actions()}
                  </div>
                }
              >
                <ActionsMenu>{actions()}</ActionsMenu>
              </Show>
            </Show>
            {props.action}
          </div>
        </Show>
      </div>
      <Show when={props.center && !centered()}>
        <div class="flex flex-wrap items-center gap-2">{props.center}</div>
      </Show>
    </div>
  );
}
