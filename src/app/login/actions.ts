'use server';

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { signSession, timingSafeEqual, SESSION_COOKIE, COOKIE_MAX_AGE } from '@/lib/auth';

export async function loginAction(formData: FormData) {
  const password  = String(formData.get('password') ?? '');
  const expected  = process.env.DASHBOARD_PASSWORD ?? '';
  const authSecret = process.env.AUTH_SECRET ?? '';

  if (!expected || !authSecret) {
    redirect('/login?error=config');
  }

  const ok = await timingSafeEqual(password, expected);
  if (!ok) {
    redirect('/login?error=1');
  }

  const token = await signSession(authSecret);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });

  redirect('/');
}
