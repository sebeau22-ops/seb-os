'use client';

import { useState, useEffect } from 'react';
import type { CrmTask } from './CrmBoard';

const URGENCY_OPTIONS = [
  { value: 'today',      label: "AUJOURD'HUI",  cls: 'text-danger border-danger/30 bg-danger/10'  },
  { value: 'this_week',  label: 'CETTE SEMAINE', cls: 'text-warn border-warn/30 bg-warn/10'       },
  { value: 'this_month', label: 'CE MOIS',       cls: 'text-accent border-accent/30 bg-accent/10' },
  { value: 'someday',    label: 'PLUS TARD',     cls: 'text-ink-3 border-ink-2 bg-ink-1'          },
];

type Props = {
  task: CrmTask;
  onUpdate: (fields: Partial<CrmTask>) => void;
  onComplete: () => void;
  onDelete: () => void;
  onClose: () => void;
};

export default function TaskDrawer({ task, onUpdate, onComplete, onDelete, onClose }: Props) {
  const [title, setTitle]   = useState(task.title);
  const [desc, setDesc]     = useState(task.description ?? '');
  const [tagsStr, setTagsStr] = useState(task.tags?.join(', ') ?? '');

  useEffect(() => {
    setTitle(task.title);
    setDesc(task.description ?? '');
    setTagsStr(task.tags?.join(', ') ?? '');
  }, [task.id]);

  function saveTitle() {
    const t = title.trim();
    if (t && t !== task.title) onUpdate({ title: t });
  }

  function saveDesc() {
    const d = desc.trim() || null;
    if (d !== (task.description ?? null)) onUpdate({ description: d });
  }

  function saveTags() {
    const tags = tagsStr.split(',').map(s => s.trim()).filter(Boolean);
    const prev = task.tags?.join(',') ?? '';
    if (tags.join(',') !== prev) onUpdate({ tags: tags.length ? tags : null });
  }

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />

      <div className="fixed right-0 top-0 h-full w-[360px] z-50 bg-ink-0 border-l border-ink-2 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-ink-2 flex-shrink-0">
          <span className="font-mono text-[10px] text-ink-3 tracking-widest">DÉTAILS TÂCHE</span>
          <button type="button" onClick={onClose} className="text-ink-3 hover:text-ink-4 text-xl leading-none">×</button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Titre */}
          <div>
            <label className="font-mono text-[9px] text-ink-3 tracking-widest uppercase block mb-1.5">Titre</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveTitle(); (e.target as HTMLInputElement).blur(); } }}
              className="w-full bg-ink-1 border border-ink-2 rounded-lg px-3 py-2 text-sm text-ink-4 focus:outline-none focus:border-accent"
            />
          </div>

          {/* Urgence */}
          <div>
            <label className="font-mono text-[9px] text-ink-3 tracking-widest uppercase block mb-1.5">Urgence</label>
            <div className="grid grid-cols-2 gap-1.5">
              {URGENCY_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onUpdate({ urgency: opt.value })}
                  className={`font-mono text-[9px] tracking-wider px-3 py-2 rounded-lg border transition-colors ${
                    task.urgency === opt.value
                      ? opt.cls
                      : 'text-ink-3 border-ink-2 bg-ink-1 hover:border-ink-3'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tâche clé */}
          <div className="flex items-center justify-between">
            <label className="font-mono text-[9px] text-ink-3 tracking-widest uppercase">Tâche clé ★</label>
            <button
              type="button"
              onClick={() => onUpdate({ key: !task.key })}
              className={`relative w-10 h-5 rounded-full border transition-colors ${
                task.key ? 'bg-accent border-accent' : 'bg-ink-1 border-ink-2'
              }`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-ink-0 transition-transform ${task.key ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

          {/* Description */}
          <div>
            <label className="font-mono text-[9px] text-ink-3 tracking-widest uppercase block mb-1.5">Description</label>
            <textarea
              value={desc}
              onChange={e => setDesc(e.target.value)}
              onBlur={saveDesc}
              rows={4}
              placeholder="Notes, contexte, détails…"
              className="w-full bg-ink-1 border border-ink-2 rounded-lg px-3 py-2 text-xs text-ink-4 placeholder-ink-3 focus:outline-none focus:border-accent resize-none"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="font-mono text-[9px] text-ink-3 tracking-widest uppercase block mb-1.5">Tags (séparés par virgule)</label>
            <input
              type="text"
              value={tagsStr}
              onChange={e => setTagsStr(e.target.value)}
              onBlur={saveTags}
              placeholder="design, client, urgent…"
              className="w-full bg-ink-1 border border-ink-2 rounded-lg px-3 py-2 text-xs text-ink-4 placeholder-ink-3 focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-ink-2 flex-shrink-0 flex gap-2">
          <button
            type="button"
            onClick={onComplete}
            className="flex-1 py-2 rounded-lg bg-ok/10 border border-ok/30 text-ok font-mono text-[10px] tracking-wider hover:bg-ok/20 transition-colors"
          >
            ✓ TERMINÉE
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="px-4 py-2 rounded-lg bg-danger/10 border border-danger/30 text-danger font-mono text-[10px] tracking-wider hover:bg-danger/20 transition-colors"
          >
            SUPPR
          </button>
        </div>
      </div>
    </>
  );
}
