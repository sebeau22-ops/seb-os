import { NextResponse } from 'next/server';
import { SESSION_COOKIE, COOKIE_MAX_AGE, signSession, timingSafeEqual } from '@/lib/auth';

export async function POST(req: Request): Promise<NextResponse> {
  let password: unknown;
  try {
    ({ password } = (await req.json()) as { password: unknown });
  } catch {
    return NextResponse.json({ error: 'Bad Request' }, { status: 400 });
  }

  if (typeof password !== 'string' || !password) {
    return NextResponse.json({ error: 'Bad Request' }, { status: 400 });
  }

  const expected = process.env.DASHBOARD_PASSWORD ?? '';
  const authSecret = process.env.AUTH_SECRET ?? '';

  if (!expected || !authSecret) {
    // Variables d'env manquantes — refus silencieux
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ok = await timingSafeEqual(password, expected);
  if (!ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = await signSession(authSecret);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });
  return res;
}
