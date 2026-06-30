import { type NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { localDateKey, type DailyNotes } from '@/lib/data/dashboard';

const USER_ID = process.env.USER_ID ?? 'seb';

export async function PATCH(req: NextRequest) {
  let body: Partial<DailyNotes>;
  try {
    body = (await req.json()) as Partial<DailyNotes>;
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }

  const today = localDateKey();

  const { data: existing, error: selErr } = await db
    .from('daily_logs')
    .select('id, notes')
    .eq('user_id', USER_ID)
    .eq('log_date', today)
    .maybeSingle();

  if (selErr) console.error('[PATCH /api/daily] select:', selErr.message);

  let current: DailyNotes = {};
  if (existing?.notes) {
    try { current = JSON.parse(existing.notes) as DailyNotes; } catch { /* empty */ }
  }

  const merged  = { ...current, ...body };
  const notesStr = JSON.stringify(merged);

  if (existing) {
    const { error } = await db
      .from('daily_logs')
      .update({ notes: notesStr })
      .eq('id', existing.id);
    if (error) {
      console.error('[PATCH /api/daily] update:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else {
    const { error } = await db
      .from('daily_logs')
      .insert({ user_id: USER_ID, log_date: today, notes: notesStr });
    if (error) {
      console.error('[PATCH /api/daily] insert:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
