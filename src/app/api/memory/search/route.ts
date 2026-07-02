import { type NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { embedText } from '@/lib/router/embedText';

export async function POST(req: NextRequest) {
  let body: { q?: string; limit?: number };
  try {
    body = (await req.json()) as { q?: string; limit?: number };
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }

  const q     = (body.q ?? '').trim();
  const limit = Math.min(body.limit ?? 6, 20);

  if (!q) return NextResponse.json({ results: [] });

  const embedding = await embedText(q);
  if (!embedding) {
    return NextResponse.json({ error: 'Embedding indisponible' }, { status: 503 });
  }

  const { data, error } = await db.rpc('match_memory_chunks', {
    query_embedding: embedding as unknown as string,
    match_count:     limit,
    match_threshold: 0.35,
  });

  if (error) {
    console.error('[memory/search]:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ results: data ?? [] });
}
