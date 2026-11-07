"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { SeriesDateEntry, SeriesDateStatus } from "@/lib/models";
import {
  formatDateLabel,
  Frequency,
  MAX_INTERVAL,
  RecurrenceRule,
  WEEKDAY_LABELS,
} from "@/lib/recurrence";
import { addDaysToDateString, weekdayOf } from "@/lib/time";

export interface RepeatSettings {
  frequency: Frequency;
  interval: number;
  weekdays: number[];
  endType: "count" | "until";
  count: number;
  until: string;
}

const DEFAULT_COUNT = 10;
const DEFAULT_UNTIL_WEEKS = 12;

export function defaultRepeatSettings(startDate: string): RepeatSettings {
  return {
    frequency: "weekly",
    interval: 1,
    weekdays: [weekdayOf(startDate)],
    endType: "count",
    count: DEFAULT_COUNT,
    until: addDaysToDateString(startDate, DEFAULT_UNTIL_WEEKS * 7),
  };
}

export function toRecurrenceRule(settings: RepeatSettings): RecurrenceRule {
  return {
    frequency: settings.frequency,
    interval: settings.interval,
    ...(settings.frequency === "weekly" ? { weekdays: settings.weekdays } : {}),
    end:
      settings.endType === "count"
        ? { type: "count", count: settings.count }
        : { type: "until", until: settings.until },
  };
}

const UNIT_LABEL: Record<Frequency, string> = { daily: "day(s)", weekly: "week(s)", monthly: "month(s)" };

interface RepeatSectionProps {
  startDate: string;
  value: RepeatSettings;
  onChange: (value: RepeatSettings) => void;
  firstDate?: string;
}

export function RepeatSection({ startDate, value, onChange, firstDate }: RepeatSectionProps) {
  const update = (patch: Partial<RepeatSettings>) => onChange({ ...value, ...patch });
  const dayOfMonth = Number(startDate.slice(8, 10));

  const toggleWeekday = (day: number) => {
    const next = value.weekdays.includes(day)
      ? value.weekdays.filter((d) => d !== day)
      : [...value.weekdays, day].sort((a, b) => a - b);
    if (next.length > 0) update({ weekdays: next });
  };

  return (
    <div className="space-y-4 rounded-md border p-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Repeats</Label>
          <Select value={value.frequency} onValueChange={(v) => update({ frequency: v as Frequency })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="repeat-interval">Every</Label>
          <div className="flex items-center gap-2">
            <Input
              id="repeat-interval"
              type="number"
              min={1}
              max={MAX_INTERVAL}
              value={value.interval}
              onChange={(e) =>
                update({ interval: Math.min(MAX_INTERVAL, Math.max(1, Number(e.target.value) || 1)) })
              }
              className="w-20"
            />
            <span className="text-sm text-muted-foreground">{UNIT_LABEL[value.frequency]}</span>
          </div>
        </div>
      </div>

      {value.frequency === "weekly" && (
        <div className="space-y-2">
          <Label>On</Label>
          <div className="flex flex-wrap gap-1">
            {WEEKDAY_LABELS.map((label, day) => (
              <button
                key={label}
                type="button"
                onClick={() => toggleWeekday(day)}
                aria-pressed={value.weekdays.includes(day)}
                className={cn(
                  "h-8 min-w-10 rounded-md border px-2 text-xs font-medium transition-colors",
                  value.weekdays.includes(day)
                    ? "border-primary bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {value.frequency === "monthly" && dayOfMonth > 28 && (
        <p className="text-xs text-amber-700 bg-amber-50 rounded p-2">
          Months without a day {dayOfMonth} are skipped.
        </p>
      )}

      <div className="space-y-2">
        <Label>Ends</Label>
        <RadioGroup value={value.endType} onValueChange={(v) => update({ endType: v as RepeatSettings["endType"] })}>
          <RadioGroupItem value="count" id="repeat-end-count">
            <span className="text-sm">After</span>
            <Input
              type="number"
              min={2}
              value={value.count}
              onChange={(e) => update({ endType: "count", count: Math.max(2, Number(e.target.value) || 2) })}
              className="h-8 w-20"
            />
            <span className="text-sm">bookings</span>
          </RadioGroupItem>
          <RadioGroupItem value="until" id="repeat-end-until">
            <span className="text-sm">On</span>
            <Input
              type="date"
              min={startDate}
              value={value.until}
              onChange={(e) => e.target.value && update({ endType: "until", until: e.target.value })}
              className="h-8 w-40"
            />
          </RadioGroupItem>
        </RadioGroup>
        <p className="text-xs text-muted-foreground">A recurring booking can run for up to 1 year.</p>
      </div>

      {firstDate && firstDate !== startDate && (
        <p className="text-xs text-amber-700 bg-amber-50 rounded p-2">
          The first booking will be on {formatDateLabel(firstDate)}, the first date that matches.
        </p>
      )}
    </div>
  );
}

const STATUS_LABEL: Record<SeriesDateStatus, string> = {
  available: "Available",
  conflict: "Taken",
  over_limit: "Over daily limit",
  past: "Already passed",
};

export function SeriesDateList({ entries }: { entries: SeriesDateEntry[] }) {
  return (
    <ul className="max-h-40 overflow-y-auto rounded-md border divide-y text-sm">
      {entries.map((entry) => (
        <li key={entry.date} className="flex items-center justify-between px-3 py-1.5">
          <span className={cn(entry.status !== "available" && "text-muted-foreground line-through")}>
            {formatDateLabel(entry.date)}
          </span>
          <span
            className={cn(
              "text-xs",
              entry.status === "available" ? "text-emerald-700" : "text-destructive"
            )}
          >
            {STATUS_LABEL[entry.status]}
          </span>
        </li>
      ))}
    </ul>
  );
}
