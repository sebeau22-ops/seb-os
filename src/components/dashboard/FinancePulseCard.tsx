'use client';

import { useState, useEffect } from 'react';
import Panel from './Panel';
import Link from 'next/link';

type HistoriqueEntry = { date: string; total: number; immo: number; placement: number };
type FinanceData = {
  ok: boolean;
  latest: {
    date_label: string;
    date_iso: string;
    totals: { placement: number; immo: number; credit: number; total: number };
  };
  historique: HistoriqueEntry[];
};

type StocksData = {
  ok: boolean;
  total_cad: number;
  daily_gain_cad: number;
  daily_gain_pct: number;
};

function fmtCAD(n: number) {
  return new Intl.NumberFormat('fr-CA', {
    style: 'currency', currency: 'CAD', maximumFractionDigits: 0,
  }).format(n);
}

function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  const H = 40, W = 100;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * W;
      const y = H - ((v - min) / range) * (H * 0.8) - H * 0.1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-10" preserveAspectRatio="none">
      <polyline
        points={pts}
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function FinancePulseCard() {
  const [data,   setData]   = useState<FinanceData | null>(null);
  const [stocks, setStocks] = useState<StocksData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/finance').then(r => r.json() as Promise<FinanceData>),
      fetch('/api/finance/stocks').then(r => r.json() as Promise<StocksData>),
    ])
      .then(([fin, stk]) => { setData(fin); setStocks(stk); })
      .catch(err => console.error('[FinancePulseCard]', err))
      .finally(() => setLoading(false));
  }, []);

  const total      = data?.latest?.totals?.total ?? null;
  const hist       = data?.historique ?? [];
  const sparkData  = hist.map(h => h.total);
  const prev       = hist.length >= 2 ? (hist[hist.length - 2]?.total ?? null) : null;
  const change     = total !== null && prev != null ? total - prev : null;
  const changePct  = change !== null && prev ? (change / prev) * 100 : null;
  const positive   = change === null || change >= 0;

  const stocksOk   = stocks?.ok === true;
  const dayGain    = stocksOk ? stocks!.daily_gain_cad : null;
  const dayGainPct = stocksOk ? stocks!.daily_gain_pct : null;
  const dayPos     = dayGain === null || dayGain >= 0;

  return (
    <Panel
      index="07"
      title="FINANCE PULSE"
      meta={
        <Link href="/finance" className="font-mono text-[9px] text-accent/70 hover:text-accent tracking-widest">
          DÉTAIL →
        </Link>
      }
    >
      <div className="p-4 flex flex-col gap-3">
        {/* ── Patrimoine net ── */}
        <div>
          <p className="font-mono text-[9px] text-ink-3 tracking-widest uppercase mb-1">
            Patrimoine net
          </p>
          {loading ? (
            <div className="h-8 w-32 bg-ink-2 rounded animate-pulse" />
          ) : total !== null ? (
            <p className="font-numeric text-2xl text-ink-4 leading-none">{fmtCAD(total)}</p>
          ) : (
            <p className="font-numeric text-2xl text-ink-3 leading-none">—</p>
          )}
          {data?.latest?.date_label && (
            <p className="font-mono text-[8px] text-ink-3 mt-0.5">{data.latest.date_label}</p>
          )}
        </div>

        {sparkData.length >= 2 && <Sparkline data={sparkData} />}

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-ink-0 border border-ink-2 px-3 py-2.5">
            <p className="font-mono text-[9px] text-ink-3 tracking-widest uppercase mb-1.5">Var. période</p>
            {loading ? (
              <div className="h-4 w-16 bg-ink-2 rounded animate-pulse" />
            ) : change !== null ? (
              <p className={`font-numeric text-sm ${positive ? 'text-ok' : 'text-danger'}`}>
                {positive ? '+' : ''}{fmtCAD(change)}
              </p>
            ) : <p className="font-numeric text-sm text-ink-3">—</p>}
          </div>
          <div className="rounded-lg bg-ink-0 border border-ink-2 px-3 py-2.5">
            <p className="font-mono text-[9px] text-ink-3 tracking-widest uppercase mb-1.5">%</p>
            {loading ? (
              <div className="h-4 w-12 bg-ink-2 rounded animate-pulse" />
            ) : changePct !== null ? (
              <p className={`font-numeric text-sm ${positive ? 'text-ok' : 'text-danger'}`}>
                {positive ? '+' : ''}{changePct.toFixed(1)}%
              </p>
            ) : <p className="font-numeric text-sm text-ink-3">—</p>}
          </div>
        </div>

        {/* ── Marchés aujourd'hui ── */}
        <div className="border-t border-ink-2 pt-3">
          <p className="font-mono text-[9px] text-ink-3 tracking-widest uppercase mb-2">
            Placements auto · aujourd&apos;hui
          </p>
          {loading ? (
            <div className="h-6 w-40 bg-ink-2 rounded animate-pulse" />
          ) : stocksOk ? (
            <div className="flex items-baseline justify-between">
              <span className="font-numeric text-base text-ink-4">
                {fmtCAD(stocks!.total_cad)}
              </span>
              <span className={`font-numeric text-sm ${dayPos ? 'text-ok' : 'text-danger'}`}>
                {dayPos ? '+' : ''}{fmtCAD(dayGain!)}
                {' '}
                <span className="text-[10px]">
                  ({dayPos ? '+' : ''}{dayGainPct!.toFixed(2)}%)
                </span>
              </span>
            </div>
          ) : (
            <p className="font-mono text-[9px] text-warn">Données indisponibles</p>
          )}
        </div>
      </div>
    </Panel>
  );
}
