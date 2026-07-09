import TopRail from '@/components/dashboard/TopRail';
import CaptureBox from '@/components/dashboard/CaptureBox';
import ReviewBoard from '@/components/review/ReviewBoard';
import { getWeeklyReview } from '@/lib/data/review';

interface Props {
  searchParams: Promise<{ week?: string }>;
}

export default async function ReviewPage({ searchParams }: Props) {
  const { week } = await searchParams;
  const raw = week !== undefined ? Number.parseInt(week, 10) : 0;
  const weekOffset = Number.isFinite(raw) && raw <= 0 ? raw : 0;

  const data = await getWeeklyReview(weekOffset);

  return (
    <div className="min-h-screen bg-ink-0 flex flex-col">
      <TopRail />
      <div className="flex-1 p-6 pb-24 max-w-2xl mx-auto w-full">
        <div className="mb-6">
          <p className="font-mono text-[10px] text-accent tracking-[0.2em] uppercase mb-1">REVIEW</p>
          <h1 className="font-mono text-[11px] text-ink-3 tracking-widest">
            Bilan hebdomadaire
          </h1>
        </div>
        <ReviewBoard data={data} />
      </div>
      <CaptureBox />
    </div>
  );
}
