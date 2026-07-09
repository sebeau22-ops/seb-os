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

export type CaptureBreakdown = { kind: string; count: number };

export type ReviewTask = {
  id: string;
  title: string;
  date: string; // completed_at (tâches complétées) ou created_at (tâches en retard), ISO
};

export type WeeklyReview = {
  weekOffset: number;
  label: string;
  captureTotal: number;
  captureBreakdown: CaptureBreakdown[];
  completedTasks: ReviewTask[];
  overdueTasks: ReviewTask[];
  streak: number;
};

const KIND_FALLBACK = 'capture';

export async function getWeeklyReview(weekOffset: number): Promise<WeeklyReview> {
  const { start, end, label } = getWeekRange(weekOffset);
  const rangeStart = `${start}T00:00:00Z`;
  const rangeEndExclusive = `${shiftDate(end, 1)}T00:00:00Z`;

  const [capturesRes, completedRes, overdueRes, streak] = await Promise.all([
    db
      .from('raw_captures')
      .select('classification')
      .eq('user_id', USER_ID)
      .gte('created_at', rangeStart)
      .lt('created_at', rangeEndExclusive),
    db
      .from('tasks')
      .select('id, title, completed_at')
      .eq('user_id', USER_ID)
      .gte('completed_at', rangeStart)
      .lt('completed_at', rangeEndExclusive)
      .order('completed_at', { ascending: false }),
    // Retard = état ACTUEL (completed_at IS NULL au moment de la requête), pas un
    // instantané de ce qui était en retard à la fin de cette semaine-là. Une tâche
    // encore ouverte apparaît donc identique en naviguant sur plusieurs semaines
    // passées. Le seuil created_at couvre aussi la semaine visionnée elle-même
    // (< fin de semaine + 1 jour), contrairement au cron weekly-review qui exclut
    // la semaine en cours (< début de semaine) — les deux chiffres peuvent donc
    // différer pour la semaine courante, ce n'est PAS le même critère que le cron.
    db
      .from('tasks')
      .select('id, title, created_at')
      .eq('user_id', USER_ID)
      .eq('urgency', 'today')
      .is('completed_at', null)
      .lt('created_at', rangeEndExclusive)
      .order('created_at', { ascending: true }),
    // Streak global (actuel), indépendant de weekOffset — ne varie pas en naviguant.
    getStreak(),
  ]);

  if (capturesRes.error) console.error('[getWeeklyReview] raw_captures:', capturesRes.error.message);
  if (completedRes.error) console.error('[getWeeklyReview] completed tasks:', completedRes.error.message);
  if (overdueRes.error) console.error('[getWeeklyReview] overdue tasks:', overdueRes.error.message);

  const breakdownMap = new Map<string, number>();
  for (const c of capturesRes.data ?? []) {
    const classification = c.classification as { kind?: string } | null;
    const kind = classification?.kind ?? KIND_FALLBACK;
    breakdownMap.set(kind, (breakdownMap.get(kind) ?? 0) + 1);
  }
  const captureBreakdown = [...breakdownMap.entries()]
    .map(([kind, count]) => ({ kind, count }))
    .sort((a, b) => b.count - a.count);

  const completedTasks: ReviewTask[] = (completedRes.data ?? []).map((t) => ({
    id: t.id as string,
    title: t.title as string,
    date: t.completed_at as string,
  }));

  const overdueTasks: ReviewTask[] = (overdueRes.data ?? []).map((t) => ({
    id: t.id as string,
    title: t.title as string,
    date: t.created_at as string,
  }));

  return {
    weekOffset,
    label,
    captureTotal: (capturesRes.data ?? []).length,
    captureBreakdown,
    completedTasks,
    overdueTasks,
    streak,
  };
}
