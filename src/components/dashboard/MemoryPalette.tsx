'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

type MemoryResult = {
  id: string;
  source_type: string;
  chunk_text: string;
  similarity: number;
};

const SOURCE_LABEL: Record<string, string> = {
  capture:  'CAPTURE',
  task:     'TÂCHE',
  journal:  'JOURNAL',
  note:     'NOTE',
  decision: 'DÉCISION',
};

export default function MemoryPalette() {
  const [open, setOpen]       = useState(false);
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState<MemoryResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ⌘K / Ctrl+K ouvre la palette
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, []);

  // Focus input à l'ouverture
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 10);
      setQuery('');
      setResults([]);
      setSelected(0);
    }
  }, [open]);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    try {
      const res  = await fetch('/api/memory/search', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ q }),
      });
      const json = (await res.json()) as { results?: MemoryResult[]; error?: string };
      setResults(json.results ?? []);
      setSelected(0);
    } catch (err) {
      console.error('[MemoryPalette]:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounce 350 ms
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { void search(query); }, 350);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query, search]);

  // Navigation clavier dans les résultats
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl mx-4 rounded-xl border border-ink-2 bg-ink-1 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Barre de recherche */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-ink-2">
          <span className="text-ink-3 flex-shrink-0">
            {loading ? (
              <span className="font-mono text-[10px] text-accent animate-pulse">···</span>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0Z" />
              </svg>
            )}
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Chercher dans ta mémoire…"
            className="flex-1 bg-transparent text-sm text-ink-4 placeholder:text-ink-3 outline-none"
          />
          <span className="font-mono text-[9px] text-ink-3 border border-ink-2 rounded px-1.5 py-0.5 flex-shrink-0">
            ESC
          </span>
        </div>

        {/* Résultats */}
        <div className="max-h-80 overflow-y-auto">
          {results.length === 0 && query.trim() && !loading && (
            <div className="px-4 py-6 text-center">
              <p className="font-mono text-[10px] text-ink-3 tracking-wider">AUCUN RÉSULTAT</p>
            </div>
          )}

          {results.length === 0 && !query.trim() && (
            <div className="px-4 py-6 text-center">
              <p className="font-mono text-[10px] text-ink-3 tracking-wider">
                TAPE UNE REQUÊTE POUR CHERCHER
              </p>
              <p className="font-mono text-[9px] text-ink-3 mt-1">
                Recherche sémantique dans tes captures
              </p>
            </div>
          )}

          {results.map((r, i) => (
            <div
              key={r.id}
              className={[
                'px-4 py-3 border-b border-ink-2 last:border-0 cursor-default',
                i === selected ? 'bg-accent/10' : 'hover:bg-ink-2/50',
              ].join(' ')}
              onMouseEnter={() => setSelected(i)}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs text-ink-4 leading-relaxed flex-1">{r.chunk_text}</p>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className="font-mono text-[8px] px-1.5 py-0.5 rounded bg-ink-2 text-ink-3 tracking-wider">
                    {SOURCE_LABEL[r.source_type] ?? r.source_type.toUpperCase()}
                  </span>
                  <span className="font-numeric text-[9px] text-ink-3">
                    {Math.round(r.similarity * 100)}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Pied de page */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-ink-2 bg-ink-0">
          <span className="font-mono text-[9px] text-ink-3">↑↓ naviguer</span>
          <span className="font-mono text-[9px] text-ink-3">⌘K fermer</span>
          <span className="font-mono text-[9px] text-ink-3 ml-auto">
            {results.length > 0 && (
              <><span className="font-numeric">{results.length}</span> résultat{results.length > 1 ? 's' : ''}</>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
