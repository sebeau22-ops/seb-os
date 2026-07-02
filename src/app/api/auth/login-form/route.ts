import { type NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, COOKIE_MAX_AGE, signSession } from '@/lib/auth';

export async function POST(req: NextRequest): Promise<NextResponse> {
  let password = '';
  try {
    const fd = await req.formData();
    password = String(fd.get('password') ?? '');
  } catch {
    return NextResponse.redirect(new URL('/login?error=1', req.url));
  }

  const expected    = (process.env.DASHBOARD_PASSWORD ?? '').trim();
  const authSecret  = (process.env.AUTH_SECRET ?? '').trim();

  console.log('[login-form] expected length:', expected.length, '| authSecret length:', authSecret.length);

  if (!expected || !authSecret || password.trim() !== expected) {
    console.log('[login-form] auth failed');
    return NextResponse.redirect(new URL('/login?error=1', req.url));
  }

  const token = await signSession(authSecret);
  console.log('[login-form] token (first 20):', token.slice(0, 20));

  const res = NextResponse.redirect(new URL('/', req.url));
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });
  return res;
}
