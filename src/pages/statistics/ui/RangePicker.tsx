import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { useSelector } from "@tanstack/react-store";
import type { DateRange as DayPickerRange } from "react-day-picker";
import { enUS, sv, zhCN } from "react-day-picker/locale";
import { languageAtom, type Language } from "@/shared/config/preferences.ts";
import { useMessages } from "@/shared/i18n/messages.ts";
import { formatWireDateRange, parseWireDate, toLocalDateString } from "@/shared/lib/date.ts";
import { Button } from "@/shared/ui/shadcn/button.tsx";
import { Calendar } from "@/shared/ui/shadcn/calendar.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/shadcn/popover.tsx";
import type { DateRange } from "@/pages/statistics/model/date-range.ts";

const CALENDAR_LOCALES = { en: enUS, sv, zh: zhCN } satisfies Record<Language, unknown>;

export function RangePicker({
  value,
  onChange,
}: {
  value: DateRange;
  onChange: (range: DateRange) => void;
}) {
  const m = useMessages();
  const language = useSelector(languageAtom);
  const [open, setOpen] = useState(false);
  // The first day picked, until a second one completes the range.
  const [draft, setDraft] = useState<DayPickerRange>();
  const [today] = useState(() => new Date());
  const label = formatWireDateRange(value.from, value.to);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setDraft(undefined);
      }}
    >
      <PopoverTrigger
        render={<Button variant="outline" aria-label={`${m.statistics.range}: ${label}`} />}
      >
        <CalendarDays data-icon="inline-start" />
        {label}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto rounded-2xl p-1">
        <Calendar
          mode="range"
          resetOnSelect
          locale={CALENDAR_LOCALES[language]}
          defaultMonth={parseWireDate(value.to)}
          disabled={{ after: today }}
          selected={draft ?? { from: parseWireDate(value.from), to: parseWireDate(value.to) }}
          onSelect={(next) => {
            if (next?.from && next.to) {
              onChange({ from: toLocalDateString(next.from), to: toLocalDateString(next.to) });
              setOpen(false);
            } else {
              setDraft(next);
            }
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
