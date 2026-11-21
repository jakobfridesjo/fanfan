import { Show } from "solid-js";
import { Calendar as CalendarPrimitive } from "@kobalte/core/calendar";
import { ChevronLeft, ChevronRight } from "lucide";
import { cn } from "@/shared/lib/class-names.ts";
import { Icon } from "@/shared/ui/Icon.tsx";
import { buttonVariants } from "@/shared/ui/shadcn/button.tsx";

interface DateSpan {
  start: Date;
  end: Date;
}

interface CalendarProps {
  /** The days chosen, first and last. */
  value: DateSpan;
  /** Called once a second day completes the range. */
  onChange: (range: DateSpan) => void;
  /** The last day that can be picked. */
  maxValue?: Date;
  /** A BCP 47 tag: names the months and days and sets the first day of the week. */
  locale: string;
  class?: string;
}

const NAV_BUTTON = cn(buttonVariants({ variant: "ghost" }), "size-8 p-0 select-none");

/** One month, in which a first and a last day are picked. */
function Calendar(props: CalendarProps) {
  return (
    <CalendarPrimitive
      data-slot="calendar"
      selectionMode="range"
      locale={props.locale}
      value={props.value}
      defaultFocusedValue={props.value.end}
      maxValue={props.maxValue}
      onChange={(range) => props.onChange(range)}
      class={cn("w-fit p-3", props.class)}
    >
      <CalendarPrimitive.Header class="flex items-center justify-between gap-1 pb-4">
        <CalendarPrimitive.PrevTrigger class={NAV_BUTTON}>
          <Icon icon={ChevronLeft} />
        </CalendarPrimitive.PrevTrigger>
        <CalendarPrimitive.Heading class="text-sm font-medium select-none" />
        <CalendarPrimitive.NextTrigger class={NAV_BUTTON}>
          <Icon icon={ChevronRight} />
        </CalendarPrimitive.NextTrigger>
      </CalendarPrimitive.Header>
      <CalendarPrimitive.Body>
        <CalendarPrimitive.Grid class="border-collapse">
          <CalendarPrimitive.GridHeader>
            <CalendarPrimitive.GridHeaderRow>
              {(weekDay) => (
                <CalendarPrimitive.GridHeaderCell class="size-8 text-[0.8rem] font-normal text-muted-foreground select-none">
                  {weekDay()}
                </CalendarPrimitive.GridHeaderCell>
              )}
            </CalendarPrimitive.GridHeaderRow>
          </CalendarPrimitive.GridHeader>
          <CalendarPrimitive.GridBody>
            {(weekIndex) => (
              <CalendarPrimitive.GridBodyRow weekIndex={weekIndex()}>
                {(date) => (
                  <Show when={date()} fallback={<td />}>
                    {(day) => (
                      <CalendarPrimitive.GridBodyCell date={day()} class="p-0 pt-1 text-center">
                        <CalendarPrimitive.GridBodyCellTrigger class="flex size-8 cursor-default items-center justify-center rounded-2xl text-sm outline-none select-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/30 data-disabled:pointer-events-none data-disabled:opacity-50 data-outside-month:text-muted-foreground data-selected:rounded-none data-selected:bg-muted data-selection-end:rounded-r-2xl data-selection-end:bg-primary data-selection-end:text-primary-foreground data-selection-start:rounded-l-2xl data-selection-start:bg-primary data-selection-start:text-primary-foreground data-today:font-semibold">
                          {day().getDate()}
                        </CalendarPrimitive.GridBodyCellTrigger>
                      </CalendarPrimitive.GridBodyCell>
                    )}
                  </Show>
                )}
              </CalendarPrimitive.GridBodyRow>
            )}
          </CalendarPrimitive.GridBody>
        </CalendarPrimitive.Grid>
      </CalendarPrimitive.Body>
    </CalendarPrimitive>
  );
}

export { Calendar };
