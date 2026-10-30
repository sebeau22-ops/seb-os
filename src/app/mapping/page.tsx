import type { Metadata } from 'next';
import TopRail from '@/components/dashboard/TopRail';
import MappingStudio from '@/components/mapping/MappingStudio';

export const metadata: Metadata = {
  title: 'Mapping — Seb OS',
};

export default function MappingPage() {
  return (
    <div className="min-h-screen bg-ink-0 flex flex-col">
      <TopRail />
      <div className="px-4 pt-4">
        <p className="font-mono text-[10px] text-accent tracking-[0.2em] uppercase mb-1">MAPPING</p>
        <h1 className="font-mono text-[11px] text-ink-3 tracking-widest">
          Projection vidéo sur objets
        </h1>
      </div>
      <MappingStudio />
    </div>
  );
}
