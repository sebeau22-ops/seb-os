'use client';

import { useState, useEffect } from 'react';
import Panel from './Panel';

type GoalItem = { id: string; text: string; done: boolean };

function GoalSection({
  scope,
  label,
  items,
  onChange,
}: {
  scope: 'week' | 'month';
  label: string;
  items: GoalItem[];
  onChange: (scope: 'week' | 'month', items: GoalItem[]) => void;
}) {
  const [draft, setDraft] = useState('');

  function addGoal() {
    const text = draft.trim();
    if (!text) return;
    onChange(scope, [...items, { id: crypto.randomUUID(), text, done: false }]);
    setDraft('');
  }

  function toggle(id: string) {
    onChange(scope, items.map(g => g.id === id ? { ...g, done: !g.done } : g));
  }

  function remove(id: string) {
    onChange(scope, items.filter(g => g.id !== id));
  }

  const done = items.filter(g => g.done).length;

  return (
    <div>
      <p className="font-mono text-[9px] text-ink-3 tracking-[0.14em] uppercase mb-2">
        {label}
        <span className="ml-2 text-accent font-numeric">{done}/{items.length}</span>
      </p>

      {items.length > 0 && (
        <ul className="space-y-1.5 mb-2">
          {items.map(g => (
            <li key={g.id} className="flex items-start gap-2 group">
              <button
                type="button"
                onClick={() => toggle(g.id)}
                className={[
                  'mt-0.5 flex-shrink-0 w-3.5 h-3.5 rounded border transition-colors',
                  g.done ? 'bg-accent border-accent' : 'border-ink-3 hover:border-accent',
                ].join(' ')}
              />
              <span className={`text-xs leading-tight flex-1 ${g.done ? 'line-through text-ink-3' : 'text-ink-4'}`}>
                {g.text}
              </span>
              <button
                type="button"
                onClick={() => remove(g.id)}
                className="opacity-0 group-hover:opacity-100 text-ink-3 hover:text-danger text-xs flex-shrink-0 leading-none"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-1.5">
        <input
          type="text"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addGoal(); } }}
          placeholder="Ajouter un objectif…"
          className="flex-1 bg-ink-0 border border-ink-2 rounded px-2 py-1 text-xs text-ink-4 placeholder-ink-3 focus:outline-none focus:border-accent"
        />
        <button
          type="button"
          onClick={addGoal}
          className="px-2.5 py-1 rounded border border-ink-2 text-ink-3 hover:border-accent hover:text-accent text-xs transition-colors"
        >
          +
        </button>
      </div>
    </div>
  );
}

export default function GoalsCard() {
  const [week, setWeek] = useState<GoalItem[]>([]);
  const [month, setMonth] = useState<GoalItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/goals')
      .then(r => r.json() as Promise<{ week: GoalItem[]; month: GoalItem[] }>)
      .then(({ week: w, month: m }) => {
        setWeek(w);
        setMonth(m);
        setLoaded(true);
      })
      .catch(err => console.error('[GoalsCard] fetch:', err));
  }, []);

  async function handleChange(scope: 'week' | 'month', items: GoalItem[]) {
    if (scope === 'week') setWeek(items);
    else setMonth(items);

    try {
      await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope, items }),
      });
    } catch (err) {
      console.error('[GoalsCard] save:', err);
    }
  }

  const totalDone = week.filter(g => g.done).length + month.filter(g => g.done).length;
  const totalAll  = week.length + month.length;

  return (
    <Panel
      index="07"
      title="OBJECTIFS"
      meta={
        totalAll > 0 ? (
          <span className="text-ink-3">
            <span className="font-numeric">{totalDone}</span>
            {'/'}
            <span className="font-numeric">{totalAll}</span>
          </span>
        ) : undefined
      }
    >
      <div className="p-4 space-y-5 flex-1 overflow-y-auto">
        {!loaded ? (
          <p className="font-mono text-[10px] text-ink-3">Chargement…</p>
        ) : (
          <>
            <GoalSection scope="week" label="Cette semaine" items={week} onChange={handleChange} />
            <div className="border-t border-ink-2" />
            <GoalSection scope="month" label="Ce mois" items={month} onChange={handleChange} />
          </>
        )}
      </div>
    </Panel>
  );
}
