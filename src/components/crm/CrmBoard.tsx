'use client';

import { useState } from 'react';
import TaskDrawer from './TaskDrawer';

export type CrmTask = {
  id: string;
  title: string;
  description: string | null;
  urgency: string;
  key: boolean;
  priority_score: number;
  tags: string[] | null;
  entity_id: string | null;
  created_at: string;
  updated_at: string | null;
  completed_at: string | null;
};

const TIERS = [
  { key: 'today',      label: "AUJOURD'HUI",   cls: 'text-danger', border: 'border-danger/40', dragBg: 'bg-danger/5 border-danger/40'  },
  { key: 'this_week',  label: 'CETTE SEMAINE', cls: 'text-warn',   border: 'border-warn/40',   dragBg: 'bg-warn/5 border-warn/40'      },
  { key: 'this_month', label: 'CE MOIS',       cls: 'text-accent', border: 'border-accent/40', dragBg: 'bg-accent/5 border-accent/40'  },
  { key: 'someday',    label: 'PLUS TARD',     cls: 'text-ink-3',  border: 'border-ink-2',     dragBg: 'bg-ink-1 border-ink-3'         },
] as const;

type View = 'kanban' | 'smart';

// ── Task card ─────────────────────────────────────────────────────────────────

function TaskCard({
  task,
  onSelect,
  onComplete,
  onDragStart,
}: {
  task: CrmTask;
  onSelect: (t: CrmTask) => void;
  onComplete: (id: string) => void;
  onDragStart: (id: string) => void;
}) {
  return (
    <div
      draggable
      onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; onDragStart(task.id); }}
      onClick={() => onSelect(task)}
      className="group bg-ink-0 border border-ink-2 rounded-lg p-3 cursor-pointer hover:border-ink-3 transition-colors"
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-ink-4 leading-snug">
            {task.key && <span className="text-accent mr-1">★</span>}
            {task.title}
          </p>
          {task.tags?.length ? (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {task.tags.map(tag => (
                <span key={tag} className="font-mono text-[8px] text-ink-3 bg-ink-1 px-1.5 py-0.5 rounded">
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onComplete(task.id); }}
          className="flex-shrink-0 opacity-0 group-hover:opacity-100 w-5 h-5 rounded border border-ink-2 hover:border-ok hover:bg-ok/10 flex items-center justify-center text-[10px] text-ink-3 hover:text-ok transition-all"
          title="Marquer terminée"
        >
          ✓
        </button>
      </div>
    </div>
  );
}

// ── Kanban column ─────────────────────────────────────────────────────────────

function KanbanColumn({
  tier,
  tasks,
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onSelect,
  onComplete,
  onDragStart,
  onCreate,
}: {
  tier: typeof TIERS[number];
  tasks: CrmTask[];
  isDragOver: boolean;
  onDragOver: () => void;
  onDragLeave: () => void;
  onDrop: () => void;
  onSelect: (t: CrmTask) => void;
  onComplete: (id: string) => void;
  onDragStart: (id: string) => void;
  onCreate: (title: string) => void;
}) {
  const [draft, setDraft] = useState('');

  function submit() {
    const t = draft.trim();
    if (!t) return;
    onCreate(t);
    setDraft('');
  }

  return (
    <div
      className={`flex flex-col rounded-xl border transition-colors min-h-[200px] ${
        isDragOver ? tier.dragBg : 'border-ink-2 bg-ink-1/40'
      }`}
      onDragOver={e => { e.preventDefault(); onDragOver(); }}
      onDragLeave={onDragLeave}
      onDrop={e => { e.preventDefault(); onDrop(); }}
    >
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-ink-2 flex items-center justify-between flex-shrink-0">
        <span className={`font-mono text-[10px] tracking-[0.14em] ${tier.cls}`}>{tier.label}</span>
        <span className="font-numeric text-[10px] text-ink-3">{tasks.length}</span>
      </div>

      {/* Tasks */}
      <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[55vh]">
        {tasks.map(t => (
          <TaskCard
            key={t.id}
            task={t}
            onSelect={onSelect}
            onComplete={onComplete}
            onDragStart={onDragStart}
          />
        ))}
      </div>

      {/* Add input */}
      <div className="p-2 border-t border-ink-2 flex-shrink-0">
        <input
          type="text"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
          placeholder="+ Nouvelle tâche…"
          className="w-full bg-ink-0 border border-ink-2 rounded-lg px-3 py-1.5 text-xs text-ink-4 placeholder-ink-3 focus:outline-none focus:border-accent"
        />
      </div>
    </div>
  );
}

// ── Smart view ────────────────────────────────────────────────────────────────

function SmartView({
  onSelect,
  onComplete,
}: {
  onSelect: (t: CrmTask) => void;
  onComplete: (id: string) => void;
}) {
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState<CrmTask[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function search() {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/tasks/smart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      setResults(await res.json() as CrmTask[]);
    } catch (err) {
      console.error('[SmartView]:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="flex gap-2 mb-6">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') void search(); }}
          placeholder="Que dois-je faire ce matin ? / tâches liées au client X…"
          className="flex-1 bg-ink-1 border border-ink-2 rounded-lg px-4 py-2.5 text-sm text-ink-4 placeholder-ink-3 focus:outline-none focus:border-accent"
        />
        <button
          type="button"
          onClick={() => void search()}
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-accent/15 text-accent border border-accent/30 font-mono text-[10px] tracking-wider hover:bg-accent/25 transition-colors disabled:opacity-50"
        >
          {loading ? '…' : 'CHERCHER'}
        </button>
      </div>

      {results !== null && (
        <div className="space-y-2">
          {results.length === 0 ? (
            <p className="font-mono text-[10px] text-ink-3">Aucun résultat pertinent</p>
          ) : (
            <>
              <p className="font-mono text-[9px] text-ink-3 mb-3">
                {results.length} RÉSULTAT{results.length > 1 ? 'S' : ''}
              </p>
              {results.map(t => (
                <TaskCard key={t.id} task={t} onSelect={onSelect} onComplete={onComplete} onDragStart={() => {}} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Board ─────────────────────────────────────────────────────────────────────

export default function CrmBoard({ initialTasks }: { initialTasks: CrmTask[] }) {
  const [tasks, setTasks]         = useState<CrmTask[]>(initialTasks);
  const [selected, setSelected]   = useState<CrmTask | null>(null);
  const [dragId, setDragId]       = useState<string | null>(null);
  const [dragOverTier, setDragOverTier] = useState<string | null>(null);
  const [view, setView]           = useState<View>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('crm-view') as View | null) ?? 'kanban';
    }
    return 'kanban';
  });

  function switchView(v: View) {
    setView(v);
    localStorage.setItem('crm-view', v);
  }

  async function createTask(urgency: string, title: string) {
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, urgency, priority_score: Date.now() }),
      });
      if (!res.ok) return;
      const task = await res.json() as CrmTask;
      setTasks(prev => [task, ...prev]);
    } catch (err) {
      console.error('[CrmBoard] create:', err);
    }
  }

  async function updateTask(id: string, fields: Partial<CrmTask>) {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...fields } : t));
    setSelected(prev => prev?.id === id ? { ...prev, ...fields } : prev);
    try {
      await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      });
    } catch (err) {
      console.error('[CrmBoard] update:', err);
    }
  }

  async function deleteTask(id: string) {
    setTasks(prev => prev.filter(t => t.id !== id));
    setSelected(null);
    try {
      await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    } catch (err) {
      console.error('[CrmBoard] delete:', err);
    }
  }

  async function completeTask(id: string) {
    setTasks(prev => prev.filter(t => t.id !== id));
    if (selected?.id === id) setSelected(null);
    try {
      await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed_at: new Date().toISOString() }),
      });
    } catch (err) {
      console.error('[CrmBoard] complete:', err);
    }
  }

  async function dropToTier(tierKey: string) {
    setDragOverTier(null);
    if (!dragId) return;
    const task = tasks.find(t => t.id === dragId);
    if (task && task.urgency !== tierKey) {
      await updateTask(dragId, { urgency: tierKey });
    }
    setDragId(null);
  }

  const openTasks = tasks.filter(t => !t.completed_at);

  return (
    <div
      className="flex flex-col gap-4 h-full"
      onDragEnd={() => { setDragId(null); setDragOverTier(null); }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] text-ink-3 tracking-widest">
          TÂCHES ACTIVES
          <span className="ml-3 font-numeric text-accent">{openTasks.length}</span>
        </span>
        <div className="flex items-center gap-1 bg-ink-1 rounded-lg p-1 border border-ink-2">
          {(['kanban', 'smart'] as const).map(v => (
            <button
              key={v}
              type="button"
              onClick={() => switchView(v)}
              className={`font-mono text-[10px] tracking-[0.15em] px-3 py-1.5 rounded-md transition-colors ${
                view === v ? 'bg-accent/15 text-accent' : 'text-ink-3 hover:text-ink-4'
              }`}
            >
              {v === 'kanban' ? 'KANBAN' : 'SMART'}
            </button>
          ))}
        </div>
      </div>

      {/* Kanban */}
      {view === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 flex-1">
          {TIERS.map(tier => (
            <KanbanColumn
              key={tier.key}
              tier={tier}
              tasks={openTasks
                .filter(t => t.urgency === tier.key)
                .sort((a, b) => b.priority_score - a.priority_score || new Date(b.created_at).getTime() - new Date(a.created_at).getTime())}
              isDragOver={dragOverTier === tier.key}
              onDragOver={() => setDragOverTier(tier.key)}
              onDragLeave={() => setDragOverTier(null)}
              onDrop={() => void dropToTier(tier.key)}
              onSelect={setSelected}
              onComplete={completeTask}
              onDragStart={setDragId}
              onCreate={title => void createTask(tier.key, title)}
            />
          ))}
        </div>
      )}

      {/* Smart */}
      {view === 'smart' && (
        <SmartView onSelect={setSelected} onComplete={completeTask} />
      )}

      {/* Drawer */}
      {selected && (
        <TaskDrawer
          task={selected}
          onUpdate={fields => void updateTask(selected.id, fields)}
          onComplete={() => void completeTask(selected.id)}
          onDelete={() => void deleteTask(selected.id)}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
