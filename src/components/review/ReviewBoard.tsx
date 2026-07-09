import Link from 'next/link';
import Panel from '@/components/dashboard/Panel';
import type { WeeklyReview, ReviewTask } from '@/lib/data/review';

const TZ = process.env.USER_TIMEZONE ?? 'America/Toronto';

const KIND_LABEL: Record<string, string> = {
  task: 'Tâches',
  journal: 'Journal',
  note: 'Notes',
  decision: 'Décisions',
  capture: 'Autres',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-CA', {
    timeZone: TZ,
    day: 'numeric',
    month: 'short',
  });
}

function TaskList({ tasks, emptyLabel }: { tasks: ReviewTask[]; emptyLabel: string }) {
  if (tasks.length === 0) {
    return (
      <div className="py-4 text-center">
        <p className="font-mono text-[10px] text-ink-3 tracking-wider">{emptyLabel}</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col divide-y divide-ink-2">
      {tasks.map((t) => (
        <div key={t.id} className="flex items-center justify-between gap-3 py-2.5">
          <p className="text-xs text-ink-4 truncate">{t.title}</p>
          <span className="font-mono text-[9px] text-ink-3 flex-shrink-0">{formatDate(t.date)}</span>
        </div>
      ))}
    </div>
  );
}

type Props = { data: WeeklyReview };

export default function ReviewBoard({ data }: Props) {
  const {
    weekOffset, label, captureTotal, captureBreakdown,
    completedTasks, overdueTasks, streak,
  } = data;

  const hasNextWeek = weekOffset < 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Link
          href={`/review?week=${weekOffset - 1}`}
          className="font-mono text-[10px] text-ink-3 hover:text-accent tracking-widest px-2 py-1 transition-colors"
        >
          ← SEMAINE PRÉC.
        </Link>
        <p className="font-mono text-[11px] text-ink-4 tracking-widest uppercase">{label}</p>
        {hasNextWeek ? (
          <Link
            href={`/review?week=${weekOffset + 1}`}
            className="font-mono text-[10px] text-ink-3 hover:text-accent tracking-widest px-2 py-1 transition-colors"
          >
            SEMAINE SUIV. →
          </Link>
        ) : (
          <span className="font-mono text-[10px] text-ink-2 tracking-widest px-2 py-1">
            SEMAINE SUIV. →
          </span>
        )}
      </div>

      <Panel index="01" title="CAPTURES" meta={<span className="font-numeric text-accent">{captureTotal}</span>}>
        <div className="p-4">
          {captureBreakdown.length === 0 ? (
            <p className="font-mono text-[10px] text-ink-3 tracking-wider text-center py-2">
              AUCUNE CAPTURE CETTE SEMAINE-LÀ
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {captureBreakdown.map((b) => (
                <div key={b.kind} className="flex items-center justify-between">
                  <span className="text-xs text-ink-4">{KIND_LABEL[b.kind] ?? b.kind}</span>
                  <span className="font-numeric text-xs text-ink-3">{b.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Panel>

      <Panel index="02" title="COMPLÉTÉES" meta={<span className="font-numeric text-accent">{completedTasks.length}</span>}>
        <div className="p-4">
          <TaskList tasks={completedTasks} emptyLabel="AUCUNE TÂCHE COMPLÉTÉE CETTE SEMAINE-LÀ" />
        </div>
      </Panel>

      <Panel index="03" title="EN RETARD" meta={<span className="font-numeric text-danger">{overdueTasks.length}</span>}>
        <div className="p-4">
          <TaskList tasks={overdueTasks} emptyLabel="AUCUNE TÂCHE EN RETARD" />
        </div>
      </Panel>

      <Panel index="04" title="STREAK">
        <div className="p-4 flex items-center justify-center">
          <p className="leading-none">
            <span className="font-numeric text-2xl text-accent">{streak}</span>
            <span className="font-mono text-[9px] text-ink-3 ml-1.5 uppercase">
              jour{streak > 1 ? 's' : ''}
            </span>
          </p>
        </div>
      </Panel>
    </div>
  );
}
