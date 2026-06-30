'use client';

import { useState } from 'react';
import Panel from './Panel';

type Habit = {
  id: string;
  label: string;
  category: string;
  target: number;
};

const HABITS: Habit[] = [
  { id: 'lever',   label: 'Lever tôt',     category: 'ROUTINE',       target: 1 },
  { id: 'med',     label: 'Méditation',     category: 'SANTÉ',         target: 1 },
  { id: 'sport',   label: 'Exercice',       category: 'SANTÉ',         target: 3 },
  { id: 'eau',     label: 'Eau 2 L',        category: 'NUTRITION',     target: 1 },
  { id: 'lecture', label: 'Lecture',        category: 'DÉVELOPPEMENT', target: 1 },
  { id: 'journal', label: 'Journalisation', category: 'ROUTINE',       target: 1 },
];

type Props = { initialHabits: string[] };

export default function HabitsCard({ initialHabits }: Props) {
  const [checked, setChecked] = useState<Set<string>>(new Set(initialHabits));

  async function toggle(id: string) {
    const next = new Set(checked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setChecked(next);

    try {
      await fetch('/api/daily', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ habits: Array.from(next) }),
      });
    } catch (err) {
      console.error('[HabitsCard] toggle:', err);
    }
  }

  const done  = checked.size;
  const total = HABITS.length;
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <Panel
      index="03"
      title="HABITUDES"
      meta={
        <span className="text-ink-3">
          <span className="font-numeric">{done}</span>/
          <span className="font-numeric">{total}</span>
          {' · '}
          <span className="font-numeric">{pct}</span>%
        </span>
      }
    >
      <div className="p-4 flex gap-4 items-start">
        {/* Cercle de score */}
        <div className="flex-shrink-0 w-[60px] h-[60px] rounded-full border-2 border-accent/40 flex flex-col items-center justify-center gap-0.5">
          <span className="font-numeric text-2xl text-accent leading-none">{pct}</span>
          <span className="font-mono text-[8px] text-ink-3 tracking-wider">SCORE</span>
        </div>

        {/* Grille de tuiles */}
        <div className="flex-1 grid grid-cols-2 gap-1.5">
          {HABITS.map((h) => {
            const active = checked.has(h.id);
            return (
              <button
                key={h.id}
                type="button"
                onClick={() => void toggle(h.id)}
                className={[
                  'rounded-lg px-3 py-2 text-left border transition-colors',
                  active
                    ? 'bg-accent/10 border-accent/40'
                    : 'bg-ink-0 border-ink-2 hover:border-ink-3',
                ].join(' ')}
              >
                <p className="font-mono text-[8px] text-ink-3 tracking-wider uppercase mb-0.5">
                  {h.category}
                </p>
                <p className={`text-xs leading-tight ${active ? 'text-accent' : 'text-ink-4'}`}>
                  {h.label}
                </p>
                <p className="font-numeric text-[10px] text-ink-3 mt-0.5">
                  {active ? h.target : 0}/{h.target}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}
