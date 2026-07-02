// Fonctionne en Edge runtime (middleware) et Node.js (API routes) — Web Crypto uniquement.

export const SESSION_COOKIE = '__seb_session';
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 jours

// ── Helpers base64url ────────────────────────────────────────────────────────

function toB64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromB64url(s: string): ArrayBuffer {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64.padEnd(Math.ceil(b64.length / 4) * 4, '=');
  const chars = atob(padded);
  const buf = new ArrayBuffer(chars.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < chars.length; i++) view[i] = chars.charCodeAt(i);
  return buf;
}

// ── Clé HMAC depuis le secret ────────────────────────────────────────────────

function importHmacKey(secret: string, usages: KeyUsage[]): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    usages,
  );
}

// ── Cookie signé ─────────────────────────────────────────────────────────────

export async function signSession(secret: string): Promise<string> {
  const payload = toB64url(
    new TextEncoder().encode(JSON.stringify({ iat: Date.now() })),
  );
  const key = await importHmacKey(secret, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return `${payload}.${toB64url(sig)}`;
}

/** Vérifie la signature HMAC du cookie. subtle.verify est timing-safe par spec. */
export async function verifySession(token: string, secret: string): Promise<boolean> {
  const sep = token.lastIndexOf('.');
  if (sep < 1) return false;
  const payload = token.slice(0, sep);
  let sig: ArrayBuffer;
  try {
    sig = fromB64url(token.slice(sep + 1));
  } catch {
    return false;
  }
  const key = await importHmacKey(secret, ['verify']);
  try {
    return await crypto.subtle.verify('HMAC', key, sig, new TextEncoder().encode(payload));
  } catch {
    return false;
  }
}

// ── Comparaison timing-safe (mots de passe, secrets) ────────────────────────
//
// On HMAC les deux chaînes avec une clé éphémère → sorties 32 octets fixes →
// XOR octet par octet sans early-exit → pas de fuite temporelle sur la longueur
// ni sur le contenu.

export async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const ephemeral = await crypto.subtle.generateKey(
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const [ha, hb] = await Promise.all([
    crypto.subtle.sign('HMAC', ephemeral, enc.encode(a)),
    crypto.subtle.sign('HMAC', ephemeral, enc.encode(b)),
  ]);
  const ua = new Uint8Array(ha);
  const ub = new Uint8Array(hb);
  let diff = 0;
  // Les deux buffers font toujours 32 octets (SHA-256) — boucle à durée fixe.
  for (let i = 0; i < 32; i++) diff |= (ua[i] ?? 0) ^ (ub[i] ?? 0);
  return diff === 0;
}
