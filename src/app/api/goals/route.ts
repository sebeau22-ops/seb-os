import { type NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/supabase';

const USER_ID = process.env.USER_ID ?? 'seb';
const SENTINEL = '2000-01-01';

export type GoalItem = { id: string; text: string; done: boolean };

type GoalNotes = {
  goals_week_items?: GoalItem[];
  goals_month_items?: GoalItem[];
};

export async function GET() {
  const { data, error } = await db
    .from('daily_logs')
    .select('notes')
    .eq('user_id', USER_ID)
    .eq('log_date', SENTINEL)
    .maybeSingle();

  if (error) console.error('[api/goals] GET:', error);

  let notes: GoalNotes = {};
  try { if (data?.notes) notes = JSON.parse(data.notes) as GoalNotes; } catch { /* */ }

  return NextResponse.json({
    week: notes.goals_week_items ?? [],
    month: notes.goals_month_items ?? [],
  });
}

export async function POST(req: NextRequest) {
  const { scope, items } = await req.json() as { scope: 'week' | 'month'; items: GoalItem[] };

  const { data, error: selErr } = await db
    .from('daily_logs')
    .select('id, notes')
    .eq('user_id', USER_ID)
    .eq('log_date', SENTINEL)
    .maybeSingle();

  if (selErr) console.error('[api/goals] select:', selErr);

  let existing: GoalNotes = {};
  try { if (data?.notes) existing = JSON.parse(data.notes) as GoalNotes; } catch { /* */ }

  const field = scope === 'week' ? 'goals_week_items' : 'goals_month_items';
  const updated: GoalNotes = { ...existing, [field]: items };

  if (data) {
    const { error } = await db
      .from('daily_logs')
      .update({ notes: JSON.stringify(updated) })
      .eq('id', data.id);
    if (error) {
      console.error('[api/goals] update:', error);
      return NextResponse.json({ error: 'update failed' }, { status: 500 });
    }
  } else {
    const { error } = await db
      .from('daily_logs')
      .insert({ user_id: USER_ID, log_date: SENTINEL, notes: JSON.stringify(updated) });
    if (error) {
      console.error('[api/goals] insert:', error);
      return NextResponse.json({ error: 'insert failed' }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
