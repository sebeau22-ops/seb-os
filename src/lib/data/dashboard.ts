import { db } from '@/lib/supabase';

const TZ      = process.env.USER_TIMEZONE ?? 'America/Toronto';
const USER_ID = process.env.USER_ID       ?? 'seb';

export function localDateKey(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ }); // YYYY-MM-DD
}

export function shiftDate(dateStr: string, days: number): string {
  // noon UTC avoids DST boundary issues
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type DailyNotes = {
  priority?: string;
  habits?: string[];
};

export type DailyLog = {
  id: string;
  log_date: string;
  mood: string | null;
  notes: DailyNotes;
};

export type Task = {
  id: string;
  title: string;
  urgency: string;
  key: boolean;
  tags: string[] | null;
  created_at: string;
};

// ── Urgency sort order ────────────────────────────────────────────────────────

const URGENCY_ORDER = ['today', 'this_week', 'this_month', 'someday'] as const;

function urgencyRank(u: string): number {
  const i = URGENCY_ORDER.indexOf(u as typeof URGENCY_ORDER[number]);
  return i === -1 ? 99 : i;
}

// ── Fetchers ──────────────────────────────────────────────────────────────────

export async function getOrCreateDailyLog(): Promise<DailyLog> {
  const today = localDateKey();

  const { data: existing, error: selErr } = await db
    .from('daily_logs')
    .select('id, log_date, mood, notes')
    .eq('user_id', USER_ID)
    .eq('log_date', today)
    .maybeSingle();

  if (selErr) console.error('[getOrCreateDailyLog] select:', selErr.message);

  if (existing) {
    let notes: DailyNotes = {};
    try { notes = JSON.parse(existing.notes ?? '{}') as DailyNotes; } catch { /* empty */ }
    return { ...existing, notes };
  }

  const { data: created, error: insErr } = await db
    .from('daily_logs')
    .insert({ user_id: USER_ID, log_date: today, notes: '{}' })
    .select('id, log_date, mood, notes')
    .single();

  if (insErr) console.error('[getOrCreateDailyLog] insert:', insErr.message);

  return { ...(created ?? { id: '', log_date: today, mood: null, notes: '{}' }), notes: {} };
}

export async function getPendingTasks(): Promise<Task[]> {
  const { data, error } = await db
    .from('tasks')
    .select('id, title, urgency, key, tags, created_at')
    .eq('user_id', USER_ID)
    .is('completed_at', null)
    .order('created_at', { ascending: false });

  if (error) console.error('[getPendingTasks]:', error.message);
  if (!data) return [];

  return [...data].sort((a, b) => urgencyRank(a.urgency) - urgencyRank(b.urgency));
}

export async function getStreak(): Promise<number> {
  const { data, error } = await db
    .from('daily_logs')
    .select('log_date')
    .eq('user_id', USER_ID)
    .order('log_date', { ascending: false })
    .limit(90);

  if (error) console.error('[getStreak]:', error.message);
  if (!data?.length) return 0;

  const today = localDateKey();
  let streak = 0;

  for (let i = 0; i < data.length; i++) {
    const expected = shiftDate(today, -i);
    if (data[i]?.log_date === expected) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}
