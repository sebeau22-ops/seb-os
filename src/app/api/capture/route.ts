import { type NextRequest, NextResponse } from 'next/server';
import { runPipeline } from '@/lib/router/pipeline';

export async function POST(req: NextRequest) {
  let body: { text?: string };
  try {
    body = (await req.json()) as { text?: string };
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }

  const text = (body.text ?? '').trim();
  if (!text) {
    return NextResponse.json({ error: 'Texte vide' }, { status: 400 });
  }

  try {
    const result = await runPipeline({ text, source: 'web' });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    console.error('[api/capture] pipeline échoué:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
