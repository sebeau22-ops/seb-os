// Persistance locale du studio de mapping :
// - la disposition (formes) dans localStorage
// - les fichiers vidéo/image dans IndexedDB (trop gros pour localStorage)

import type { Pt } from './geometry';
import type { Fit } from './renderer';

export interface Shape {
  id: string;
  name: string;
  points: Pt[];
  sourceId: string | null;
  fit: Fit;
  opacity: number;
}

export interface Layout {
  aspect: string;
  shapes: Shape[];
}

export interface StoredSource {
  id: string;
  name: string;
  type: string;
  blob: Blob;
}

const LAYOUT_KEY = 'seb-mapping-layout-v1';
const DB_NAME = 'seb-mapping';
const STORE = 'sources';

export function loadLayout(): Layout | null {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    return raw ? (JSON.parse(raw) as Layout) : null;
  } catch (e) {
    console.error('[mapping] lecture disposition échouée', e);
    return null;
  }
}

export function saveLayout(layout: Layout) {
  try {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
  } catch (e) {
    console.error('[mapping] sauvegarde disposition échouée', e);
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }).finally(() => db.close());
}

export async function listSources(): Promise<StoredSource[]> {
  try {
    return await tx('readonly', (s) => s.getAll() as IDBRequest<StoredSource[]>);
  } catch (e) {
    console.error('[mapping] lecture médiathèque échouée', e);
    return [];
  }
}

export async function putSource(src: StoredSource) {
  try {
    await tx('readwrite', (s) => s.put(src));
  } catch (e) {
    console.error('[mapping] enregistrement média échoué', e);
  }
}

export async function deleteSource(id: string) {
  try {
    await tx('readwrite', (s) => s.delete(id));
  } catch (e) {
    console.error('[mapping] suppression média échouée', e);
  }
}
