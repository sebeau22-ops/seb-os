'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

type ToastState = { msg: string; ok: boolean } | null;

export default function CaptureBox() {
  const [expanded, setExpanded] = useState(false);
  const [text, setText]         = useState('');
  const [loading, setLoading]   = useState(false);
  const [toast, setToast]       = useState<ToastState>(null);
  const textareaRef             = useRef<HTMLTextAreaElement>(null);

  // Auto-focus quand on ouvre
  useEffect(() => {
    if (expanded) textareaRef.current?.focus();
  }, [expanded]);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const handleSubmit = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    try {
      const res = await fetch('/api/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed }),
      });
      const data = (await res.json()) as { ok?: boolean; summary?: string; kind?: string; error?: string };
      if (!res.ok) {
        showToast(`Erreur : ${data.error ?? 'inconnue'}`, false);
      } else {
        showToast(`✓ ${data.summary ?? 'Capturé !'}`, true);
        setText('');
        setExpanded(false);
      }
    } catch (err) {
      console.error('[CaptureBox] fetch échoué:', err);
      showToast('Erreur réseau', false);
    } finally {
      setLoading(false);
    }
  }, [text, loading]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void handleSubmit();
    }
    if (e.key === 'Escape') setExpanded(false);
  };

  return (
    <>
      {/* Toast de confirmation */}
      {toast && (
        <div
          className={[
            'fixed bottom-24 left-1/2 -translate-x-1/2 z-[100]',
            'px-4 py-2 rounded-lg text-sm font-mono shadow-xl',
            'border backdrop-blur-md transition-all',
            toast.ok
              ? 'bg-ok/10 border-ok/40 text-ok'
              : 'bg-danger/10 border-danger/40 text-danger',
          ].join(' ')}
        >
          {toast.msg}
        </div>
      )}

      {/* Boîte flottante */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-xl px-3">
        {expanded ? (
          <div className="rounded-xl bg-ink-1/96 border border-ink-2 backdrop-blur-md shadow-2xl overflow-hidden">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={4}
              placeholder="Capture une pensée, tâche, note… (⌘↵ pour enregistrer)"
              className="w-full bg-transparent px-4 pt-4 pb-2 text-sm text-ink-4 placeholder-ink-3 resize-none outline-none font-sans"
            />
            <div className="flex items-center justify-between px-4 pb-3 pt-1 border-t border-ink-2">
              <span className="font-mono text-[10px] text-ink-3">
                L'IA classe automatiquement
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setExpanded(false); setText(''); }}
                  className="font-mono text-[10px] text-ink-3 hover:text-ink-4 px-3 py-1 rounded border border-ink-2 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={() => void handleSubmit()}
                  disabled={loading || !text.trim()}
                  className="font-mono text-[10px] px-3 py-1 rounded bg-accent/15 text-accent border border-accent/40 hover:bg-accent/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? '…' : 'Capturer'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setExpanded(true)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-ink-1/90 border border-ink-2 backdrop-blur-md shadow-lg hover:border-accent/50 hover:bg-ink-1 transition-all group"
          >
            <span className="text-ink-3 group-hover:text-accent text-xl leading-none transition-colors">
              +
            </span>
            <span className="font-mono text-[11px] text-ink-3 group-hover:text-ink-4 transition-colors">
              Capturer une pensée, tâche, note…
            </span>
            <kbd className="ml-auto font-mono text-[9px] text-ink-3 px-1.5 py-0.5 rounded border border-ink-2">
              ⌘K
            </kbd>
          </button>
        )}
      </div>
    </>
  );
}
