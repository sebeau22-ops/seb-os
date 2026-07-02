'use client';

import { useState } from 'react';

type MemoryResult = { id: string; source_type: string; chunk_text: string; similarity: number };
type AskSource    = { id: string; type: string; text: string; similarity: number };
type AskResult    = { answer: string; sources: AskSource[] };
type Mode = 'ask' | 'search';

const SOURCE_LABEL: Record<string, string> = {
  capture: 'CAPTURE',
  task:    'TÂCHE',
  journal: 'JOURNAL',
  note:    'NOTE',
  decision:'DÉCISION',
};

export default function BrainBoard() {
  const [mode, setMode]           = useState<Mode>('ask');
  const [query, setQuery]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [searchResults, setSearchResults] = useState<MemoryResult[] | null>(null);
  const [askResult, setAskResult] = useState<AskResult | null>(null);

  function switchMode(m: Mode) {
    setMode(m);
    setSearchResults(null);
    setAskResult(null);
  }

  async function runSearch() {
    if (!query.trim()) return;
    setLoading(true);
    setSearchResults(null);
    try {
      const res = await fetch('/api/memory/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: query, limit: 15 }),
      });
      const data = await res.json() as { results: MemoryResult[] };
      setSearchResults(data.results ?? []);
    } catch (err) {
      console.error('[BrainBoard] search:', err);
    } finally {
      setLoading(false);
    }
  }

  async function runAsk() {
    if (!query.trim()) return;
    setLoading(true);
    setAskResult(null);
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: query }),
      });
      setAskResult(await res.json() as AskResult);
    } catch (err) {
      console.error('[BrainBoard] ask:', err);
    } finally {
      setLoading(false);
    }
  }

  function submit() {
    if (mode === 'search') void runSearch();
    else void runAsk();
  }

  return (
    <div className="space-y-6">
      {/* Mode switcher */}
      <div className="flex items-center gap-1 bg-ink-1 rounded-lg p-1 border border-ink-2 w-fit">
        {(['ask', 'search'] as const).map(m => (
          <button
            key={m}
            type="button"
            onClick={() => switchMode(m)}
            className={`font-mono text-[10px] tracking-[0.15em] px-4 py-2 rounded-md transition-colors ${
              mode === m ? 'bg-accent/15 text-accent' : 'text-ink-3 hover:text-ink-4'
            }`}
          >
            {m === 'ask' ? 'DEMANDER' : 'CHERCHER'}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="space-y-2">
        <p className="font-mono text-[9px] text-ink-3 tracking-widest uppercase">
          {mode === 'ask'
            ? 'Pose une question — Claude répond depuis ta mémoire'
            : 'Cherche des souvenirs par similarité sémantique'}
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit(); }}
            placeholder={
              mode === 'ask'
                ? "Qu'est-ce que j'ai dit sur le projet X ?"
                : 'réunion client, décision, idée…'
            }
            className="flex-1 bg-ink-1 border border-ink-2 rounded-lg px-4 py-3 text-sm text-ink-4 placeholder-ink-3 focus:outline-none focus:border-accent"
            autoFocus
          />
          <button
            type="button"
            onClick={submit}
            disabled={loading || !query.trim()}
            className="px-5 py-2 rounded-lg bg-accent/15 text-accent border border-accent/30 font-mono text-[10px] tracking-wider hover:bg-accent/25 transition-colors disabled:opacity-50"
          >
            {loading ? '…' : mode === 'ask' ? 'DEMANDER' : 'CHERCHER'}
          </button>
        </div>
      </div>

      {/* Ask results */}
      {mode === 'ask' && askResult && (
        <div className="space-y-4">
          <div className="rounded-xl border border-accent/20 bg-accent/5 p-5">
            <p className="font-mono text-[9px] text-accent tracking-widest mb-3">RÉPONSE</p>
            <p className="text-sm text-ink-4 leading-relaxed whitespace-pre-wrap">{askResult.answer}</p>
          </div>

          {askResult.sources.length > 0 && (
            <div>
              <p className="font-mono text-[9px] text-ink-3 tracking-widest uppercase mb-2">Sources utilisées</p>
              <div className="space-y-2">
                {askResult.sources.map((s, i) => (
                  <div key={`${s.id}-${i}`} className="flex gap-3 rounded-lg border border-ink-2 bg-ink-0 p-3">
                    <span className="font-mono text-[10px] text-accent flex-shrink-0 w-6">[{i + 1}]</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-[8px] text-ink-3 bg-ink-1 px-1.5 py-0.5 rounded">
                          {SOURCE_LABEL[s.type] ?? s.type.toUpperCase()}
                        </span>
                        <span className="font-numeric text-[8px] text-ink-3">{Math.round(s.similarity * 100)}%</span>
                      </div>
                      <p className="text-xs text-ink-3 leading-snug line-clamp-2">{s.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Search results */}
      {mode === 'search' && searchResults !== null && (
        <div>
          {searchResults.length === 0 ? (
            <p className="font-mono text-[10px] text-ink-3">Aucun souvenir trouvé</p>
          ) : (
            <div className="space-y-2">
              <p className="font-mono text-[9px] text-ink-3 tracking-widest mb-3">
                {searchResults.length} SOUVENIR{searchResults.length > 1 ? 'S' : ''}
              </p>
              {searchResults.map(r => (
                <div key={r.id} className="rounded-lg border border-ink-2 bg-ink-0 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-mono text-[8px] text-ink-3 bg-ink-1 px-1.5 py-0.5 rounded">
                      {SOURCE_LABEL[r.source_type] ?? r.source_type.toUpperCase()}
                    </span>
                    <span className="font-numeric text-[10px] text-accent">
                      {Math.round(r.similarity * 100)}%
                    </span>
                  </div>
                  <p className="text-xs text-ink-4 leading-relaxed">{r.chunk_text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
