'use client';

import { useMemo } from 'react';
import Panel from './Panel';

const FR_SHORT_DAYS = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'] as const;

type PlaceholderEvent = {
  time: string;
  title: string;
  context: string;
  tag: string;
};

const PLACEHOLDER_EVENTS: PlaceholderEvent[] = [
  { time: '09:00', title: 'Réunion équipe',    context: 'Bureau principal', tag: 'TRAVAIL' },
  { time: '11:30', title: 'Appel client',       context: 'Client A',        tag: 'CRM'     },
  { time: '14:00', title: 'Bloc profond',       context: 'Développement',   tag: 'FOCUS'   },
  { time: '17:00', title: 'Revue quotidienne',  context: 'Personnel',       tag: 'ROUTINE' },
];

function getWeekDays(): Array<{ date: Date; isToday: boolean }> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dow = today.getDay(); // 0 = dim
  const offset = dow === 0 ? -6 : 1 - dow; // ramène à lundi
  const monday = new Date(today);
  monday.setDate(today.getDate() + offset);

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return { date: d, isToday: d.getTime() === today.getTime() };
  });
}

export default function CalendarCard() {
  const days = useMemo(() => getWeekDays(), []);
  const monthLabel = useMemo(
    () =>
      new Date()
        .toLocaleDateString('fr-CA', { month: 'long', year: 'numeric' })
        .toUpperCase(),
    [],
  );

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
                isToday
                  ? 'bg-accent/15 border-accent/40'
                  : 'border-transparent',
              ].join(' ')}
            >
              <span className="font-mono text-[8px] text-ink-3 tracking-wider">
                {FR_SHORT_DAYS[i] ?? ''}
              </span>
              <span
                className={`font-numeric text-sm leading-none ${
                  isToday ? 'text-accent' : 'text-ink-4'
                }`}
              >
                {date.getDate()}
              </span>
            </div>
          ))}
        </div>

        {/* Liste d'événements */}
        <div className="flex flex-col divide-y divide-ink-2">
          {PLACEHOLDER_EVENTS.map((ev) => (
            <div key={`${ev.time}-${ev.title}`} className="flex items-start gap-3 py-2.5">
              <span className="font-numeric text-[10px] text-ink-3 w-10 flex-shrink-0 pt-0.5">
                {ev.time}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-ink-4 truncate">{ev.title}</p>
                <p className="font-mono text-[9px] text-ink-3 mt-0.5">{ev.context}</p>
              </div>
              <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-ink-2 text-ink-3 flex-shrink-0 tracking-wider">
                {ev.tag}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}
