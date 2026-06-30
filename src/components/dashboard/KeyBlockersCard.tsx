'use client';

import { useState } from 'react';
import Panel from './Panel';
import type { Task } from '@/lib/data/dashboard';

const URGENCY_LABEL: Record<string, string> = {
  today:      'URGENT',
  this_week:  'SEMAINE',
  this_month: 'MOIS',
  someday:    'PLUS TARD',
};

const URGENCY_STYLE: Record<string, string> = {
  today:      'bg-danger/15 text-danger border border-danger/30',
  this_week:  'bg-warn/15   text-warn   border border-warn/30',
  this_month: 'bg-accent/15 text-accent border border-accent/30',
  someday:    'bg-ink-2     text-ink-3  border border-ink-2',
};

type Props = { tasks: Task[] };

export default function KeyBlockersCard({ tasks }: Props) {
  const [pending, setPending] = useState<Task[]>(tasks);
  const [loading, setLoading] = useState<string | null>(null);

  async function complete(id: string) {
    setLoading(id);
    setPending((prev) => prev.filter((t) => t.id !== id));
    try {
      await fetch('/api/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
    } catch (err) {
      console.error('[KeyBlockersCard] complete:', err);
    } finally {
      setLoading(null);
    }
  }

  return (
    <Panel
      index="06"
      title="TÂCHES CLÉS"
      meta={
        <span className="text-ink-3">
          <span className="font-numeric">{pending.length}</span> ACTIVES
        </span>
      }
    >
      {pending.length === 0 ? (
        <div className="px-4 py-6 text-center">
          <p className="font-mono text-[10px] text-ok tracking-wider">✓ AUCUNE TÂCHE EN ATTENTE</p>
        </div>
      ) : (
        <div className="divide-y divide-ink-2">
          {pending.slice(0, 5).map((t) => (
            <div key={t.id} className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-ink-4 truncate">{t.title}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {t.key && (
                    <span className="font-mono text-[8px] text-accent tracking-wider">★ KEY</span>
                  )}
                  <span
                    className={`font-mono text-[8px] px-1.5 py-0.5 rounded tracking-wider ${URGENCY_STYLE[t.urgency] ?? URGENCY_STYLE.someday}`}
                  >
                    {URGENCY_LABEL[t.urgency] ?? t.urgency.toUpperCase()}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => complete(t.id)}
                disabled={loading === t.id}
                className="flex-shrink-0 w-6 h-6 rounded border border-ink-2 hover:border-ok hover:bg-ok/10 transition-colors flex items-center justify-center text-ink-3 hover:text-ok disabled:opacity-40"
                title="Marquer terminée"
              >
                ✓
              </button>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
