import Shell           from '@/components/dashboard/Shell';
import TopRail         from '@/components/dashboard/TopRail';
import OperatorCard    from '@/components/dashboard/OperatorCard';
import FinancePulseCard from '@/components/dashboard/FinancePulseCard';
import KeyBlockersCard from '@/components/dashboard/KeyBlockersCard';
import SessionCard     from '@/components/dashboard/SessionCard';
import HabitsCard      from '@/components/dashboard/HabitsCard';
import CalendarCard    from '@/components/dashboard/CalendarCard';
import NutritionCard   from '@/components/dashboard/NutritionCard';

export default function Home() {
  return (
    <Shell
      topRail={<TopRail />}
      left={
        <>
          <OperatorCard />
          <FinancePulseCard />
          <KeyBlockersCard />
        </>
      }
      center={
        <>
          <SessionCard />
          <HabitsCard />
          <CalendarCard />
        </>
      }
      right={<NutritionCard />}
    />
  );
}
