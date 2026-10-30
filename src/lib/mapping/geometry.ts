// Géométrie pour le projection mapping : homographies + triangulation.
// Toutes les coordonnées sont normalisées 0..1 sur la scène (y vers le bas).

export interface Pt { x: number; y: number }

/** Matrice 3×3 en ordre ligne (row-major). */
export type Mat3 = [number, number, number, number, number, number, number, number, number];

export const IDENTITY: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

export function mul3(a: Mat3, b: Mat3): Mat3 {
  const r: number[] = [];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      r.push(a[i * 3]! * b[j]! + a[i * 3 + 1]! * b[3 + j]! + a[i * 3 + 2]! * b[6 + j]!);
    }
  }
  return r as Mat3;
}

export function invert3(m: Mat3): Mat3 | null {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-12) return null;
  const s = 1 / det;
  return [
    A * s, -(b * i - c * h) * s, (b * f - c * e) * s,
    B * s, (a * i - c * g) * s, -(a * f - c * d) * s,
    C * s, -(a * h - b * g) * s, (a * e - b * d) * s,
  ];
}

/**
 * Homographie carré unité → quadrilatère (Heckbert).
 * (0,0)→q[0], (1,0)→q[1], (1,1)→q[2], (0,1)→q[3].
 */
export function squareToQuad(q: Pt[]): Mat3 {
  const [p0, p1, p2, p3] = q as [Pt, Pt, Pt, Pt];
  const dx1 = p1.x - p2.x, dx2 = p3.x - p2.x, dx3 = p0.x - p1.x + p2.x - p3.x;
  const dy1 = p1.y - p2.y, dy2 = p3.y - p2.y, dy3 = p0.y - p1.y + p2.y - p3.y;

  if (Math.abs(dx3) < 1e-12 && Math.abs(dy3) < 1e-12) {
    return [p1.x - p0.x, p2.x - p1.x, p0.x, p1.y - p0.y, p2.y - p1.y, p0.y, 0, 0, 1];
  }
  const den = dx1 * dy2 - dx2 * dy1;
  const g = (dx3 * dy2 - dx2 * dy3) / den;
  const h = (dx1 * dy3 - dx3 * dy1) / den;
  return [
    p1.x - p0.x + g * p1.x, p3.x - p0.x + h * p3.x, p0.x,
    p1.y - p0.y + g * p1.y, p3.y - p0.y + h * p3.y, p0.y,
    g, h, 1,
  ];
}

export function bbox(pts: Pt[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, w: Math.max(maxX - minX, 1e-6), h: Math.max(maxY - minY, 1e-6) };
}

function signedArea(pts: Pt[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!, q = pts[(i + 1) % pts.length]!;
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

function cross(a: Pt, b: Pt, c: Pt): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function inTriangle(p: Pt, a: Pt, b: Pt, c: Pt): boolean {
  const d1 = cross(a, b, p), d2 = cross(b, c, p), d3 = cross(c, a, p);
  const neg = d1 < 0 || d2 < 0 || d3 < 0;
  const pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos);
}

/** Triangulation par oreilles. Retourne un tableau plat [x,y, x,y, ...] de triangles. */
export function triangulate(pts: Pt[]): number[] {
  const out: number[] = [];
  if (pts.length < 3) return out;
  const orient = Math.sign(signedArea(pts)) || 1;
  const idx = pts.map((_, i) => i);
  let guard = 0;

  while (idx.length > 3 && guard++ < 10_000) {
    let clipped = false;
    for (let k = 0; k < idx.length; k++) {
      const ia = idx[(k + idx.length - 1) % idx.length]!, ib = idx[k]!, ic = idx[(k + 1) % idx.length]!;
      const a = pts[ia]!, b = pts[ib]!, c = pts[ic]!;
      if (cross(a, b, c) * orient <= 0) continue; // sommet réflexe
      let contains = false;
      for (const j of idx) {
        if (j === ia || j === ib || j === ic) continue;
        if (inTriangle(pts[j]!, a, b, c)) { contains = true; break; }
      }
      if (contains) continue;
      out.push(a.x, a.y, b.x, b.y, c.x, c.y);
      idx.splice(k, 1);
      clipped = true;
      break;
    }
    if (!clipped) {
      // Polygone auto-intersectant : on termine en éventail
      for (let k = 1; k < idx.length - 1; k++) {
        const a = pts[idx[0]!]!, b = pts[idx[k]!]!, c = pts[idx[k + 1]!]!;
        out.push(a.x, a.y, b.x, b.y, c.x, c.y);
      }
      return out;
    }
  }
  const [a, b, c] = idx.map((i) => pts[i]!) as [Pt, Pt, Pt];
  out.push(a.x, a.y, b.x, b.y, c.x, c.y);
  return out;
}

/** Point le plus proche sur le segment [a,b] et paramètre t. */
export function projectOnSegment(p: Pt, a: Pt, b: Pt): { pt: Pt; dist: number } {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy || 1e-12;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  const pt = { x: a.x + t * dx, y: a.y + t * dy };
  return { pt, dist: Math.hypot(p.x - pt.x, p.y - pt.y) };
}
