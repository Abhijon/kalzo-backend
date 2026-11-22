import { prisma } from "../lib/prisma";
import { WEEKDAY_ORDER, weekdayName } from "../utils/weekdays";

export {
  formatDateOnly,
  parseDateOnly,
  parseWeekday,
  weekdayFromDate,
  weekdayName,
  WEEKDAY_NAMES,
  WEEKDAY_ORDER,
} from "../utils/weekdays";

/** Ensure all 7 weekdays exist for an artist (default inactive). */
export async function ensureWeekdays(artistProfileId: string) {
  const existing = await prisma.artistAvailabilityWeekday.findMany({
    where: { artistProfileId },
    select: { weekday: true },
  });
  const have = new Set(existing.map((r) => r.weekday));
  const missing = [0, 1, 2, 3, 4, 5, 6].filter((d) => !have.has(d));
  if (missing.length) {
    await prisma.artistAvailabilityWeekday.createMany({
      data: missing.map((weekday) => ({
        artistProfileId,
        weekday,
        isActive: false,
      })),
      skipDuplicates: true,
    });
  }
}

export async function listWeekdaysForArtist(artistProfileId: string) {
  await ensureWeekdays(artistProfileId);
  const rows = await prisma.artistAvailabilityWeekday.findMany({
    where: { artistProfileId },
  });
  const byWeekday = new Map(rows.map((r) => [r.weekday, r]));
  return WEEKDAY_ORDER.map((weekday) => {
    const row = byWeekday.get(weekday)!;
    return {
      id: row.id,
      weekday: row.weekday,
      day: weekdayName(row.weekday),
      isActive: row.isActive,
    };
  });
}

export async function setWeekdayActive(
  artistProfileId: string,
  weekday: number,
  isActive: boolean,
) {
  await ensureWeekdays(artistProfileId);
  const row = await prisma.artistAvailabilityWeekday.upsert({
    where: { artistProfileId_weekday: { artistProfileId, weekday } },
    create: { artistProfileId, weekday, isActive },
    update: { isActive },
  });
  return {
    id: row.id,
    weekday: row.weekday,
    day: weekdayName(row.weekday),
    isActive: row.isActive,
  };
}

export async function isWeekdayActive(artistProfileId: string, weekday: number) {
  const row = await prisma.artistAvailabilityWeekday.findUnique({
    where: { artistProfileId_weekday: { artistProfileId, weekday } },
  });
  return row?.isActive === true;
}

/** Public: Mon–Sun with isActive (customers use this for THIS WEEK tiles). */
export async function listPublicWeekdays(artistProfileId: string) {
  return listWeekdaysForArtist(artistProfileId);
}
