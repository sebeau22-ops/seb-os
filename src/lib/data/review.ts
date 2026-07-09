import { db } from '@/lib/supabase';
import { localDateKey, shiftDate, getStreak } from '@/lib/data/dashboard';

const USER_ID = process.env.USER_ID ?? 'seb';

// ── Types ─────────────────────────────────────────────────────────────────────

export type WeekRange = {
  start: string;   // YYYY-MM-DD, lundi
  end: string;      // YYYY-MM-DD, dimanche
  label: string;    // "6 juil. – 12 juil. 2026"
};

// ── Plage de semaine ─────────────────────────────────────────────────────────

const DAY_MONTH_FMT = new Intl.DateTimeFormat('fr-CA', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

export function getWeekRange(weekOffset: number): WeekRange {
  const today = localDateKey();
  const dow = new Date(`${today}T12:00:00Z`).getUTCDay(); // 0=dim..6=sam
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const start = shiftDate(today, mondayOffset + weekOffset * 7);
  const end = shiftDate(start, 6);

  const startDate = new Date(`${start}T12:00:00Z`);
  const endDate = new Date(`${end}T12:00:00Z`);
  const label = `${DAY_MONTH_FMT.format(startDate)} – ${DAY_MONTH_FMT.format(endDate)} ${endDate.getUTCFullYear()}`;

  return { start, end, label };
}
