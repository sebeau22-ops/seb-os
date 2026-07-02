import { type NextRequest, NextResponse } from 'next/server';

function cleanEnv(v: string | undefined): string {
  // Strip BOM (U+FEFF, charCode 65279) and whitespace injected by Turbopack
  return [...(v ?? '')].filter(c => c.charCodeAt(0) !== 0xFEFF).join('').trim();
}

const BOURSE_URL  = cleanEnv(process.env.BOURSE_URL) || 'https://bourse.sebastienbeaulieu.ca';
const HUB_API_KEY = cleanEnv(process.env.HUB_API_KEY);

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  if (!HUB_API_KEY) {
    return NextResponse.json(
      { ok: false, error: 'HUB_API_KEY non configurée — redémarre le serveur dev' },
      { status: 503 },
    );
  }

  try {
    const res = await fetch(`${BOURSE_URL}/api/patrimoine/latest`, {
      headers: { 'X-Hub-Key': HUB_API_KEY },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('[/api/finance] Bourse server:', res.status, text);
      return NextResponse.json(
        { ok: false, error: `Bourse server HTTP ${res.status}` },
        { status: 503 },
      );
    }

    const data: unknown = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[/api/finance] fetch error:', msg);
    return NextResponse.json(
      { ok: false, error: `Réseau: ${msg}` },
      { status: 503 },
    );
  }
}
