'use client';

import { useState, useEffect } from 'react';
import Panel from './Panel';

function greeting(hour: number): string {
  if (hour < 12) return 'Bon matin';
  if (hour < 18) return 'Bon après-midi';
  return 'Bonsoir';
}

export default function SessionCard() {
  const [time, setTime]         = useState('--:--:--');
  const [salut, setSalut]       = useState('Bonjour');
  const [dateLong, setDateLong] = useState('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('fr-CA', { hour12: false }));
      setSalut(greeting(now.getHours()));
      setDateLong(
        now.toLocaleDateString('fr-CA', {
          weekday: 'long',
          year:    'numeric',
          month:   'long',
          day:     'numeric',
        }),
      );
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <Panel index="02" title="SESSION">
      <div className="p-5 flex flex-col gap-5">
        {/* Salut + date */}
        <div>
          <h2 className="font-display text-2xl text-ink-4 leading-tight">
            {salut}, Sébastien.
          </h2>
          <p className="font-mono text-[10px] text-ink-3 tracking-wider mt-1 capitalize">
            {dateLong}
          </p>
        </div>

        {/* Horloge */}
        <p className="font-numeric text-5xl text-ink-4 tracking-tight leading-none">
          {time}
        </p>

        {/* Priorité du jour */}
        <div className="flex flex-col gap-2">
          <label
            htmlFor="priority-input"
            className="font-mono text-[9px] text-ink-3 tracking-widest uppercase"
          >
            Aujourd'hui je vais
          </label>
          <textarea
            id="priority-input"
            rows={2}
            placeholder="Définis ta priorité du jour…"
            className="w-full rounded-lg bg-ink-0 border border-ink-2 px-3 py-2.5 text-sm text-ink-4 placeholder:text-ink-3 resize-none outline-none focus:border-accent transition-colors"
          />
          <button
            type="button"
            className="self-start font-mono text-[10px] tracking-widest uppercase px-4 py-2 rounded-lg bg-accent/15 text-accent border border-accent/30 hover:bg-accent/25 transition-colors"
          >
            Capture
          </button>
        </div>
      </div>
    </Panel>
  );
}
