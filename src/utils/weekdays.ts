/** JS / Postgres convention: 0=Sunday … 6=Saturday */
export const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export type WeekdayName = (typeof WEEKDAY_NAMES)[number];

/** Display order Mon → Sun (for artist UI). */
export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

export function weekdayName(weekday: number): WeekdayName {
  return WEEKDAY_NAMES[weekday] ?? "Sunday";
}

export function parseWeekday(input: unknown): number | null {
  if (typeof input === "number" && Number.isInteger(input) && input >= 0 && input <= 6) {
    return input;
  }
  const text = String(input ?? "")
    .trim()
    .toLowerCase();
  const byName: Record<string, number> = {
    sunday: 0,
    sun: 0,
    monday: 1,
    mon: 1,
    tuesday: 2,
    tue: 2,
    tues: 2,
    wednesday: 3,
    wed: 3,
    thursday: 4,
    thu: 4,
    thur: 4,
    thurs: 4,
    friday: 5,
    fri: 5,
    saturday: 6,
    sat: 6,
  };
  if (text in byName) return byName[text]!;
  const asNum = Number(text);
  if (Number.isInteger(asNum) && asNum >= 0 && asNum <= 6) return asNum;
  return null;
}

/** UTC weekday for a YYYY-MM-DD date string / Date stored as @db.Date */
export function weekdayFromDate(date: Date): number {
  return date.getUTCDay();
}

export function parseDateOnly(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}
