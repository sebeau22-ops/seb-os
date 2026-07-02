import TopRail      from '@/components/dashboard/TopRail';
import FinanceBoard from '@/components/finance/FinanceBoard';
import CaptureBox   from '@/components/dashboard/CaptureBox';

export default function FinancePage() {
  return (
    <div className="min-h-screen bg-ink-0 flex flex-col">
      <TopRail />
      <div className="flex-1 p-6 pb-24 max-w-2xl mx-auto w-full">
        <div className="mb-6">
          <p className="font-mono text-[10px] text-accent tracking-[0.2em] uppercase mb-1">FINANCE</p>
          <h1 className="font-mono text-[11px] text-ink-3 tracking-widest">
            Patrimoine · <span className="text-ink-4">bourse.sebastienbeaulieu.ca</span>
          </h1>
        </div>
        <FinanceBoard />
      </div>
      <CaptureBox />
    </div>
  );
}
