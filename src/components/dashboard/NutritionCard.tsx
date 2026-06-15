'use client';

import { useState } from 'react';
import Panel from './Panel';

type Macro = {
  key: string;
  label: string;
  current: number;
  target: number;
  unit: string;
  barColor: string;
};

const MACROS: Macro[] = [
  { key: 'prot', label: 'PROTÉINES', current: 0, target: 180, unit: 'g', barColor: 'bg-ok'     },
  { key: 'gluc', label: 'GLUCIDES',  current: 0, target: 300, unit: 'g', barColor: 'bg-accent'  },
  { key: 'lip',  label: 'LIPIDES',   current: 0, target: 80,  unit: 'g', barColor: 'bg-warn'    },
];

type Meal = {
  time: string;
  label: string;
  kcal: number | null;
};

const MEAL_PLACEHOLDERS: Meal[] = [
  { time: '—:—', label: 'Aucun repas enregistré', kcal: null },
  { time: '—:—', label: 'Aucun repas enregistré', kcal: null },
  { time: '—:—', label: 'Aucun repas enregistré', kcal: null },
];

const TOTAL_KCAL = 2800;
const CURRENT_KCAL = 0;

export default function NutritionCard() {
  const [note, setNote] = useState('');
  const deficit = CURRENT_KCAL - TOTAL_KCAL;

  return (
    <Panel
      index="08"
      title="NUTRITION"
      meta={<span className="text-ink-3">AUJOURD'HUI</span>}
    >
      <div className="p-4 flex flex-col gap-4">
        {/* Kcal total */}
        <div>
          <p className="leading-none">
            <span className="font-numeric text-3xl text-ink-4">{CURRENT_KCAL}</span>
            <span className="font-mono text-xs text-ink-3 ml-1.5">
              sur {TOTAL_KCAL} kcal
            </span>
          </p>
          <p className="font-numeric text-xs text-danger mt-1">
            {deficit} déficit
          </p>
        </div>

        {/* Barres macros */}
        <div className="flex flex-col gap-3">
          {MACROS.map((m) => {
            const pct = Math.min(
              m.target > 0 ? (m.current / m.target) * 100 : 0,
              100,
            );
            return (
              <div key={m.key}>
                <div className="flex justify-between items-baseline mb-1">
                  <span className="font-mono text-[9px] text-ink-3 tracking-wider">
                    {m.label}
                  </span>
                  <span className="font-numeric text-[10px] text-ink-3">
                    {m.current}/{m.target}{m.unit}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-ink-2">
                  <div
                    className={`h-full rounded-full ${m.barColor} transition-all`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Champ de saisie rapide */}
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note un repas — essaie 'estimer 500 cals'"
          className="w-full rounded-lg bg-ink-0 border border-ink-2 px-3 py-2 text-xs text-ink-4 placeholder:text-ink-3 outline-none focus:border-accent transition-colors"
        />

        {/* Liste de repas */}
        <div>
          <p className="font-mono text-[9px] text-ink-3 tracking-widest uppercase mb-2">
            Repas
          </p>
          <div className="flex flex-col divide-y divide-ink-2">
            {MEAL_PLACEHOLDERS.map((meal, i) => (
              <div key={i} className="flex items-center gap-3 py-2">
                <span className="font-numeric text-[10px] text-ink-3 w-8 flex-shrink-0">
                  {meal.time}
                </span>
                <span className="text-xs text-ink-3 flex-1 italic">{meal.label}</span>
                {meal.kcal !== null && (
                  <span className="font-numeric text-[10px] text-ink-3">
                    {meal.kcal} kcal
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Panel>
  );
}
