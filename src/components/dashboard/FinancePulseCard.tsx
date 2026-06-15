import Panel from './Panel';

const SPARKLINE_DATA = [22, 31, 27, 38, 35, 48, 42, 51, 46, 60, 55, 68];

function Sparkline() {
  const H = 40;
  const W = 100;
  const max = Math.max(...SPARKLINE_DATA);
  const min = Math.min(...SPARKLINE_DATA);
  const range = max - min || 1;

  const pts = SPARKLINE_DATA.map((v, i) => {
    const x = (i / (SPARKLINE_DATA.length - 1)) * W;
    const y = H - ((v - min) / range) * (H * 0.8) - H * 0.1;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-10"
      preserveAspectRatio="none"
    >
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
  return (
    <Panel
      index="07"
      title="FINANCE PULSE"
      meta={<span className="text-ok animate-pulse">● LIVE</span>}
    >
      <div className="p-4 flex flex-col gap-3">
        {/* Net Worth */}
        <div>
          <p className="font-mono text-[9px] text-ink-3 tracking-widest uppercase mb-1">
            Net Worth
          </p>
          <p className="font-numeric text-3xl text-ink-4 leading-none">$—</p>
        </div>

        <Sparkline />

        {/* Daily / Mensuel */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-ink-0 border border-ink-2 px-3 py-2.5">
            <p className="font-mono text-[9px] text-ink-3 tracking-widest uppercase mb-1.5">
              Daily
            </p>
            <p className="font-numeric text-sm text-ok">+$—</p>
          </div>
          <div className="rounded-lg bg-ink-0 border border-ink-2 px-3 py-2.5">
            <p className="font-mono text-[9px] text-ink-3 tracking-widest uppercase mb-1.5">
              Mensuel
            </p>
            <p className="font-numeric text-sm text-ok">+$—</p>
          </div>
        </div>
      </div>
    </Panel>
  );
}
