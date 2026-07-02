import { type NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/supabase';

const USER_ID = process.env.USER_ID ?? 'seb';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') ?? 'open';

  let query = db
    .from('tasks')
    .select('id, title, description, urgency, key, priority_score, tags, entity_id, created_at, updated_at, completed_at')
    .eq('user_id', USER_ID);

  if (status === 'open') {
    query = query.is('completed_at', null);
  } else if (status === 'done') {
    query = query.not('completed_at', 'is', null);
  }

  const { data, error } = await query
    .order('priority_score', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[GET /api/tasks]:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    title: string;
    urgency?: string;
    key?: boolean;
    description?: string;
    tags?: string[];
    priority_score?: number;
  };

  if (!body.title) {
    return NextResponse.json({ error: 'title requis' }, { status: 400 });
  }

  const { data, error } = await db
    .from('tasks')
    .insert({
      user_id: USER_ID,
      title: body.title,
      urgency: body.urgency ?? 'someday',
      key: body.key ?? false,
      priority_score: body.priority_score ?? Date.now(),
      description: body.description ?? null,
      tags: body.tags?.length ? body.tags : null,
    })
    .select('id, title, description, urgency, key, priority_score, tags, entity_id, created_at, updated_at, completed_at')
    .single();

  if (error) {
    console.error('[POST /api/tasks]:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

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
