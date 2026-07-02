import { type NextRequest, NextResponse } from 'next/server';

const BOURSE_URL = process.env.BOURSE_URL ?? 'https://bourse.sebastienbeaulieu.ca';
const HUB_API_KEY = process.env.HUB_API_KEY ?? '';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  if (!HUB_API_KEY) {
    return NextResponse.json({ error: 'HUB_API_KEY non configurée' }, { status: 503 });
  }

  try {
    const res = await fetch(`${BOURSE_URL}/api/patrimoine/latest`, {
      headers: { 'X-Hub-Key': HUB_API_KEY },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('[/api/finance] Bourse server:', res.status, text);
      return NextResponse.json({ error: 'Bourse server indisponible' }, { status: 503 });
    }

    const data: unknown = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error('[/api/finance] fetch error:', err);
    return NextResponse.json({ error: 'Impossible de contacter le serveur Bourse' }, { status: 503 });
  }
}
