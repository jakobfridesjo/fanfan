import { createSignal } from "solid-js";
import { CalendarDays } from "lucide";
import { useMessages } from "@/shared/i18n/messages.ts";
import { formatWireDateRange, parseWireDate, toLocalDateString } from "@/shared/lib/date.ts";
import { appLocale } from "@/shared/lib/locale.ts";
import { languageAtom } from "@/shared/config/preferences.ts";
import { Icon } from "@/shared/ui/Icon.tsx";
import { Button } from "@/shared/ui/shadcn/button.tsx";
import { Calendar } from "@/shared/ui/shadcn/calendar.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/shadcn/popover.tsx";
import type { DateRange } from "@/pages/statistics/model/date-range.ts";

export function RangePicker(props: { value: DateRange; onChange: (range: DateRange) => void }) {
  const m = useMessages();
  const [open, setOpen] = createSignal(false);
  const today = new Date();
  const label = () => formatWireDateRange(props.value.from, props.value.to);
  const locale = () => {
    languageAtom();
    return appLocale();
  };

  return (
    <Popover open={open()} onOpenChange={setOpen} placement="bottom-end">
      <PopoverTrigger
        as={Button}
        variant="outline"
        aria-label={`${m.statistics.range}: ${label()}`}
      >
        <Icon icon={CalendarDays} data-icon="inline-start" />
        {label()}
      </PopoverTrigger>
      <PopoverContent class="w-auto rounded-2xl p-1">
        <Calendar
          locale={locale()}
          maxValue={today}
          value={{ start: parseWireDate(props.value.from), end: parseWireDate(props.value.to) }}
          onChange={(range) => {
            props.onChange({
              from: toLocalDateString(range.start),
              to: toLocalDateString(range.end),
            });
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
