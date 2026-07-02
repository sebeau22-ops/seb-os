import TopRail    from '@/components/dashboard/TopRail';
import BrainBoard  from '@/components/brain/BrainBoard';
import CaptureBox  from '@/components/dashboard/CaptureBox';

export default function BrainPage() {
  return (
    <div className="min-h-screen bg-ink-0 flex flex-col">
      <TopRail />
      <div className="flex-1 p-6 pb-24 max-w-3xl mx-auto w-full">
        <div className="mb-6">
          <p className="font-mono text-[10px] text-accent tracking-[0.2em] uppercase mb-1">BRAIN</p>
          <h1 className="font-mono text-[11px] text-ink-3 tracking-widest">
            Mémoire vectorielle · {' '}
            <span className="text-ink-4">OpenAI text-embedding-3-small</span>
          </h1>
        </div>
        <BrainBoard />
      </div>
      <CaptureBox />
    </div>
  );
}
