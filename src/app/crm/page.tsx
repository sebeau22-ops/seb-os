import TopRail    from '@/components/dashboard/TopRail';
import CrmBoard   from '@/components/crm/CrmBoard';
import CaptureBox from '@/components/dashboard/CaptureBox';
import { db }     from '@/lib/supabase';
import type { CrmTask } from '@/components/crm/CrmBoard';

export const dynamic = 'force-dynamic';

const USER_ID = process.env.USER_ID ?? 'seb';

export default async function CrmPage() {
  const { data: tasks, error } = await db
    .from('tasks')
    .select('id, title, description, urgency, key, priority_score, tags, entity_id, created_at, updated_at, completed_at')
    .eq('user_id', USER_ID)
    .is('completed_at', null)
    .order('priority_score', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) console.error('[/crm] tasks fetch:', error.message);

  return (
    <div className="min-h-screen bg-ink-0 flex flex-col">
      <TopRail />
      <div className="flex-1 p-4 pb-24">
        <CrmBoard initialTasks={(tasks ?? []) as CrmTask[]} />
      </div>
      <CaptureBox />
    </div>
  );
}
