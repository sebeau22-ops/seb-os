import { type NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/supabase';

const USER_ID = process.env.USER_ID ?? 'seb';

type Params = { params: Promise<{ id: string }> };

const ALLOWED_FIELDS = ['title', 'description', 'urgency', 'key', 'priority_score', 'tags', 'completed_at'];

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json() as Record<string, unknown>;

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const field of ALLOWED_FIELDS) {
    if (field in body) update[field] = body[field];
  }

  const { error } = await db
    .from('tasks')
    .update(update)
    .eq('id', id)
    .eq('user_id', USER_ID);

  if (error) {
    console.error(`[PATCH /api/tasks/${id}]:`, error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;

  const { error } = await db
    .from('tasks')
    .delete()
    .eq('id', id)
    .eq('user_id', USER_ID);

  if (error) {
    console.error(`[DELETE /api/tasks/${id}]:`, error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
