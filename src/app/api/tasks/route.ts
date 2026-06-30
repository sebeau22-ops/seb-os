import { type NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/supabase';

const USER_ID = process.env.USER_ID ?? 'seb';

export async function PATCH(req: NextRequest) {
  let body: { id: string };
  try {
    body = (await req.json()) as { id: string };
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }

  if (!body.id) {
    return NextResponse.json({ error: 'id requis' }, { status: 400 });
  }

  const { error } = await db
    .from('tasks')
    .update({ completed_at: new Date().toISOString() })
    .eq('id', body.id)
    .eq('user_id', USER_ID);

  if (error) {
    console.error('[PATCH /api/tasks]:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
