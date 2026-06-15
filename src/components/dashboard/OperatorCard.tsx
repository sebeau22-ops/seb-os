import Panel from './Panel';

export default function OperatorCard() {
  return (
    <Panel
      index="01"
      title="OPERATOR"
      meta={<span className="text-ok">● ONLINE</span>}
    >
      <div className="p-4 flex flex-col gap-4">
        {/* Avatar + identité */}
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-lg bg-ink-2 border border-ink-2 flex items-center justify-center flex-shrink-0">
            <span className="font-mono text-lg text-ink-3">SE</span>
          </div>
          <div className="min-w-0">
            <p className="font-display text-base text-ink-4 leading-tight">Sébastien</p>
            <p className="font-mono text-[9px] text-ink-3 tracking-wider mt-1 uppercase">
              Spécialiste Hardware · Marieville
            </p>
          </div>
        </div>

        {/* Blocs FOCUS / STREAK */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-ink-0 border border-ink-2 px-3 py-2.5">
            <p className="font-mono text-[9px] text-ink-3 tracking-widest uppercase mb-1.5">
              Focus
            </p>
            <p className="text-xs text-ink-4 leading-snug">[ta priorité]</p>
          </div>
          <div className="rounded-lg bg-ink-0 border border-ink-2 px-3 py-2.5">
            <p className="font-mono text-[9px] text-ink-3 tracking-widest uppercase mb-1.5">
              Streak
            </p>
            <p className="leading-none">
              <span className="font-numeric text-xl text-accent">0</span>
              <span className="font-mono text-[9px] text-ink-3 ml-1.5">JOURS</span>
            </p>
          </div>
        </div>
      </div>
    </Panel>
  );
}
