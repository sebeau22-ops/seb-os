import { type NextRequest, NextResponse } from 'next/server';

function cleanEnv(v: string | undefined): string {
  // Strip BOM (U+FEFF, charCode 65279) and whitespace injected by Turbopack
  return [...(v ?? '')].filter(c => c.charCodeAt(0) !== 0xFEFF).join('').trim();
}

const BOURSE_URL  = cleanEnv(process.env.BOURSE_URL)  || 'https://bourse.sebastienbeaulieu.ca';
const HUB_API_KEY = cleanEnv(process.env.HUB_API_KEY);

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  if (!HUB_API_KEY) {
    return NextResponse.json({ ok: false, error: 'HUB_API_KEY non configurée' }, { status: 503 });
  }
  try {
    const res = await fetch(`${BOURSE_URL}/api/stocks/detail`, {
      headers: { 'X-Hub-Key': HUB_API_KEY },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: `Bourse HTTP ${res.status}` }, { status: 503 });
    }
    return NextResponse.json(await res.json());
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 503 });
  }
}
