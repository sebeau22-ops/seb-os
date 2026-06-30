import Shell            from '@/components/dashboard/Shell';
import TopRail          from '@/components/dashboard/TopRail';
import OperatorCard     from '@/components/dashboard/OperatorCard';
import FinancePulseCard from '@/components/dashboard/FinancePulseCard';
import KeyBlockersCard  from '@/components/dashboard/KeyBlockersCard';
import SessionCard      from '@/components/dashboard/SessionCard';
import HabitsCard       from '@/components/dashboard/HabitsCard';
import CalendarCard     from '@/components/dashboard/CalendarCard';
import NutritionCard    from '@/components/dashboard/NutritionCard';
import CaptureBox       from '@/components/dashboard/CaptureBox';
import { getOrCreateDailyLog, getPendingTasks, getStreak } from '@/lib/data/dashboard';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const [dailyLog, tasks, streak] = await Promise.all([
    getOrCreateDailyLog(),
    getPendingTasks(),
    getStreak(),
  ]);

  const keyTasks = tasks.filter(
    (t) => t.key || t.urgency === 'today' || t.urgency === 'this_week',
  );

  return (
    <>
      <Shell
        topRail={<TopRail />}
        left={
          <>
            <OperatorCard focus={dailyLog.notes.priority ?? null} streak={streak} />
            <FinancePulseCard />
            <KeyBlockersCard tasks={keyTasks} />
          </>
        }
        center={
          <>
            <SessionCard initialPriority={dailyLog.notes.priority ?? ''} />
            <HabitsCard  initialHabits={dailyLog.notes.habits ?? []} />
            <CalendarCard tasks={tasks} />
          </>
        }
        right={<NutritionCard />}
      />
      <CaptureBox />
    </>
  );
}
