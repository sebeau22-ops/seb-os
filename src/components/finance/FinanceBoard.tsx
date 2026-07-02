'use client';

import { useState, useEffect } from 'react';

type PlacementEntry = { valeur: number; change: number };
type ImmoEntry = { valeur: number; change: number };
type CreditEntry = { valeur: number; change: number };
type Totals = { placement: number; immo: number; credit: number; total: number };

type Snapshot = {
  date_label: string;
  date_iso: string;
  placements: Record<string, PlacementEntry>;
  immo: Record<string, ImmoEntry>;
  credit: Record<string, CreditEntry>;
  totals: Totals;
};

type HistoriqueEntry = { date: string; total: number; immo: number; placement: number };

type FinanceData = {
  ok: boolean;
  latest: Snapshot;
  historique: HistoriqueEntry[];
};

function fmt(n: number, compact = false) {
  if (compact && Math.abs(n) >= 1000) {
    return new Intl.NumberFormat('fr-CA', {
      style: 'currency',
      currency: 'CAD',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(n);
  }
  return new Intl.NumberFormat('fr-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 0,
  }).format(n);
}

function sign(n: number) {
  return n >= 0 ? '+' : '';
}

function Sparkline({ data, height = 60 }: { data: number[]; height?: number }) {
  if (data.length < 2) return null;
  const W = 200, H = height;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * W;
      const y = H - ((v - min) / range) * (H * 0.85) - H * 0.075;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      <polyline
        points={pts}
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CategoryBar({ placement, immo, credit }: { placement: number; immo: number; credit: number }) {
  const total = placement + immo + credit;
  if (total <= 0) return null;
  const pPct = (placement / total) * 100;
  const iPct = (immo / total) * 100;
  const cPct = (credit / total) * 100;

  return (
    <div className="space-y-2">
      <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
        <div
          className="bg-accent/70 transition-all"
          style={{ width: `${pPct}%` }}
          title={`Placements ${pPct.toFixed(0)}%`}
        />
        <div
          className="bg-ok/60 transition-all"
          style={{ width: `${iPct}%` }}
          title={`Immo ${iPct.toFixed(0)}%`}
        />
        <div
          className="bg-warn/50 transition-all"
          style={{ width: `${cPct}%` }}
          title={`Liquidités/Crédit ${cPct.toFixed(0)}%`}
        />
      </div>
      <div className="flex gap-4 text-[9px] font-mono text-ink-3">
        <span><span className="inline-block w-2 h-2 rounded-sm bg-accent/70 mr-1" />Placements {pPct.toFixed(0)}%</span>
        <span><span className="inline-block w-2 h-2 rounded-sm bg-ok/60 mr-1" />Immo {iPct.toFixed(0)}%</span>
        <span><span className="inline-block w-2 h-2 rounded-sm bg-warn/50 mr-1" />Liquidités {cPct.toFixed(0)}%</span>
      </div>
    </div>
  );
}

function PositionRow({ name, valeur, change }: { name: string; valeur: number; change: number }) {
  const pos = change >= 0;
  return (
    <div className="flex items-center justify-between py-2 border-b border-ink-2 last:border-0">
      <span className="text-sm text-ink-4">{name}</span>
      <div className="flex items-center gap-3">
        <span className={`font-mono text-[10px] ${pos ? 'text-ok' : 'text-danger'}`}>
          {sign(change)}{fmt(change)}
        </span>
        <span className="font-numeric text-sm text-ink-4 min-w-[90px] text-right">{fmt(valeur)}</span>
      </div>
    </div>
  );
}

export default function FinanceBoard() {
  const [data, setData] = useState<FinanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/finance')
      .then(r => r.json() as Promise<FinanceData & { error?: string }>)
      .then(d => {
        if (!d.ok) setError(d.error ?? 'Données patrimoine indisponibles');
        else setData(d);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Erreur réseau'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 bg-ink-1 border border-ink-2 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-warn/30 bg-warn/5 p-6 text-center">
        <p className="font-mono text-[10px] text-warn tracking-widest mb-2">SERVEUR INDISPONIBLE</p>
        <p className="text-sm text-ink-3">{error ?? 'Erreur inconnue'}</p>
        <p className="font-mono text-[9px] text-ink-3 mt-3">
          Vérifie que le serveur Bourse tourne sur bourse.sebastienbeaulieu.ca
        </p>
      </div>
    );
  }

  const { latest, historique } = data;
  const { totals } = latest;
  const prev = historique.length >= 2 ? (historique[historique.length - 2]?.total ?? null) : null;
  const change = prev !== null ? totals.total - prev : null;
  const changePct = change !== null && prev ? (change / prev) * 100 : null;
  const pos = change === null || change >= 0;

  const sparkData = historique.map(h => h.total);

  const placements = Object.entries(latest.placements).sort(
    (a, b) => b[1].valeur - a[1].valeur,
  );
  const immo = Object.entries(latest.immo).sort((a, b) => b[1].valeur - a[1].valeur);
  const totalPlacement = Object.values(latest.placements).reduce((s, v) => s + v.valeur, 0);
  const totalImmo = Object.values(latest.immo).reduce((s, v) => s + v.valeur, 0);
  const totalCredit = Object.values(latest.credit).reduce((s, v) => s + v.valeur, 0);

  return (
    <div className="space-y-6">
      {/* Net Worth */}
      <div className="rounded-xl border border-ink-2 bg-ink-1 p-6">
        <p className="font-mono text-[9px] text-ink-3 tracking-widest uppercase mb-2">
          Patrimoine net · {latest.date_label}
        </p>
        <div className="flex items-end gap-4 mb-1">
          <p className="font-numeric text-4xl text-ink-4 leading-none">{fmt(totals.total)}</p>
          {change !== null && (
            <div className="flex items-center gap-2 mb-0.5">
              <span className={`font-numeric text-lg ${pos ? 'text-ok' : 'text-danger'}`}>
                {sign(change)}{fmt(change)}
              </span>
              {changePct !== null && (
                <span className={`font-mono text-[10px] ${pos ? 'text-ok' : 'text-danger'}`}>
                  ({sign(changePct)}{changePct.toFixed(1)}%)
                </span>
              )}
            </div>
          )}
        </div>
        {sparkData.length >= 2 && (
          <div className="mt-4">
            <Sparkline data={sparkData} height={60} />
            <div className="flex justify-between mt-1">
              <span className="font-mono text-[8px] text-ink-3">{historique[0]?.date}</span>
              <span className="font-mono text-[8px] text-ink-3">{historique[historique.length - 1]?.date}</span>
            </div>
          </div>
        )}
      </div>

      {/* Répartition */}
      <div className="rounded-xl border border-ink-2 bg-ink-1 p-5">
        <p className="font-mono text-[9px] text-ink-3 tracking-widest uppercase mb-4">
          Répartition
        </p>
        <CategoryBar placement={totalPlacement} immo={totalImmo} credit={totalCredit} />
        <div className="grid grid-cols-3 gap-3 mt-4">
          {[
            { label: 'Placements', value: totalPlacement, color: 'text-accent' },
            { label: 'Immobilier', value: totalImmo, color: 'text-ok' },
            { label: 'Liquidités', value: totalCredit, color: 'text-warn' },
          ].map(c => (
            <div key={c.label} className="rounded-lg bg-ink-0 border border-ink-2 px-3 py-2.5">
              <p className="font-mono text-[8px] text-ink-3 tracking-widest mb-1">{c.label.toUpperCase()}</p>
              <p className={`font-numeric text-sm ${c.color}`}>{fmt(c.value, true)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Placements */}
      {placements.length > 0 && (
        <div className="rounded-xl border border-ink-2 bg-ink-1 p-5">
          <p className="font-mono text-[9px] text-ink-3 tracking-widest uppercase mb-3">
            Placements · {fmt(totalPlacement)}
          </p>
          <div>
            {placements.map(([name, entry]) => (
              <PositionRow key={name} name={name} valeur={entry.valeur} change={entry.change} />
            ))}
          </div>
        </div>
      )}

      {/* Immobilier */}
      {immo.length > 0 && (
        <div className="rounded-xl border border-ink-2 bg-ink-1 p-5">
          <p className="font-mono text-[9px] text-ink-3 tracking-widest uppercase mb-3">
            Immobilier (équité) · {fmt(totalImmo)}
          </p>
          <div>
            {immo.map(([name, entry]) => (
              <PositionRow key={name} name={name} valeur={entry.valeur} change={entry.change} />
            ))}
          </div>
        </div>
      )}

      {/* Lien Bourse */}
      <div className="text-center">
        <a
          href="https://bourse.sebastienbeaulieu.ca"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 font-mono text-[10px] tracking-widest text-accent/70 hover:text-accent transition-colors"
        >
          OUVRIR DASHBOARD BOURSE →
        </a>
      </div>
    </div>
  );
}
