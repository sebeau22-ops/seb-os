import { type NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, verifySession, timingSafeEqual } from '@/lib/auth';

// ── Routes publiques ─────────────────────────────────────────────────────────

const PUBLIC_EXACT = new Set(['/login']);

const PUBLIC_PREFIXES = [
  '/api/auth/',             // login / logout (dont login-form)
  '/api/telegram/webhook',  // webhook entrant
];

function isPublic(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

// ── Middleware ───────────────────────────────────────────────────────────────

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();

  const authSecret = process.env.AUTH_SECRET ?? '';
  const apiSecret  = process.env.API_SECRET  ?? '';

  // 1. Header x-api-secret (accès programmatique — CLI, cron, n8n)
  const headerSecret = req.headers.get('x-api-secret') ?? '';
  if (headerSecret && apiSecret && await timingSafeEqual(headerSecret, apiSecret)) {
    return NextResponse.next();
  }

  // 2. Cookie de session signé HMAC
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  console.log('[middleware]', pathname, '| cookie present:', !!token, '| authSecret length:', authSecret.length);
  if (token && authSecret) {
    const valid = await verifySession(token, authSecret.trim()).catch((e) => {
      console.error('[middleware] verifySession threw:', e);
      return false;
    });
    if (valid) return NextResponse.next();
    console.warn('[middleware] verifySession FAILED for token:', token.slice(0, 20));
  } else if (!authSecret) {
    console.warn('[middleware] AUTH_SECRET manquant');
  } else {
    console.log('[middleware] no session cookie');
  }

  // 3. Non authentifié → 401 pour les routes API, redirect sinon
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = '/login';
  loginUrl.search = '';
  return NextResponse.redirect(loginUrl);
}

// ── Matcher — exclut les assets statiques ───────────────────────────────────

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
