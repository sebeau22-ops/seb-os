'use client';

import { useMemo } from 'react';
import Panel from './Panel';
import type { Task } from '@/lib/data/dashboard';

const FR_SHORT_DAYS = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'] as const;

const URGENCY_BADGE: Record<string, { label: string; style: string }> = {
  today:      { label: 'AUJOURD\'HUI', style: 'bg-danger/15 text-danger border border-danger/30' },
  this_week:  { label: 'SEMAINE',      style: 'bg-warn/15   text-warn   border border-warn/30'  },
  this_month: { label: 'MOIS',         style: 'bg-accent/15 text-accent border border-accent/30'},
  someday:    { label: 'UN JOUR',      style: 'bg-ink-2     text-ink-3  border border-ink-2'    },
};

function getWeekDays(): Array<{ date: Date; isToday: boolean }> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dow    = today.getDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(today);
  monday.setDate(today.getDate() + offset);

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return { date: d, isToday: d.getTime() === today.getTime() };
  });
}

type Props = { tasks: Task[] };

export default function CalendarCard({ tasks }: Props) {
  const days       = useMemo(() => getWeekDays(), []);
  const monthLabel = useMemo(
    () =>
      new Date()
        .toLocaleDateString('fr-CA', { month: 'long', year: 'numeric' })
        .toUpperCase(),
    [],
  );

  const displayed = tasks.slice(0, 5);

  return (
    <Panel
      index="04"
      title="CALENDRIER"
      meta={<span className="text-ink-3">{monthLabel}</span>}
    >
      <div className="p-4 flex flex-col gap-4">
        {/* Bande 7 jours */}
        <div className="grid grid-cols-7 gap-1">
          {days.map(({ date, isToday }, i) => (
            <div
              key={date.toISOString()}
              className={[
                'flex flex-col items-center gap-0.5 py-2 rounded-lg border',
                isToday ? 'bg-accent/15 border-accent/40' : 'border-transparent',
              ].join(' ')}
            >
              <span className="font-mono text-[8px] text-ink-3 tracking-wider">
                {FR_SHORT_DAYS[i] ?? ''}
              </span>
              <span className={`font-numeric text-sm leading-none ${isToday ? 'text-accent' : 'text-ink-4'}`}>
                {date.getDate()}
              </span>
            </div>
          ))}
        </div>

        {/* Liste de tâches */}
        {displayed.length === 0 ? (
          <div className="py-4 text-center">
            <p className="font-mono text-[10px] text-ok tracking-wider">✓ AUCUNE TÂCHE EN ATTENTE</p>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-ink-2">
            {displayed.map((t) => {
              const badge = URGENCY_BADGE[t.urgency] ?? URGENCY_BADGE['someday']!;
              return (
                <div key={t.id} className="flex items-start gap-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-ink-4 truncate">{t.title}</p>
                    {t.tags && t.tags.length > 0 && (
                      <p className="font-mono text-[9px] text-ink-3 mt-0.5 truncate">
                        {t.tags.join(' · ')}
                      </p>
                    )}
                  </div>
                  <span className={`font-mono text-[8px] px-1.5 py-0.5 rounded flex-shrink-0 tracking-wider ${badge.style}`}>
                    {badge.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Panel>
  );
}
