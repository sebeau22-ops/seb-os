import Panel from './Panel';

type Tag = 'HOT' | 'WARM';

type Blocker = {
  id: string;
  title: string;
  owner: string;
  days: number;
  tag: Tag;
};

const BLOCKERS: Blocker[] = [
  {
    id: '1',
    title: 'Migration serveur en attente',
    owner: 'Client A',
    days: 3,
    tag: 'HOT',
  },
  {
    id: '2',
    title: 'Devis fournisseur non reçu',
    owner: 'Fournisseur B',
    days: 5,
    tag: 'WARM',
  },
  {
    id: '3',
    title: 'Validation contrat en suspens',
    owner: 'Équipe légale',
    days: 1,
    tag: 'HOT',
  },
];

const TAG_STYLE: Record<Tag, string> = {
  HOT:  'bg-danger/15 text-danger border border-danger/30',
  WARM: 'bg-warn/15  text-warn   border border-warn/30',
};

export default function KeyBlockersCard() {
  return (
    <Panel
      index="06"
      title="BLOCAGES"
      meta={<span className="text-ink-3">3 ACTIFS · VOIR TOUT</span>}
    >
      <div className="divide-y divide-ink-2">
        {BLOCKERS.map((b) => (
          <div key={b.id} className="flex items-start justify-between gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-ink-4 truncate">{b.title}</p>
              <p className="font-mono text-[9px] text-ink-3 mt-0.5 tracking-wider uppercase">
                Resp. {b.owner} · Bloqué{' '}
                <span className="font-numeric">{b.days}</span>J
              </p>
            </div>
            <span
              className={`font-mono text-[9px] px-1.5 py-0.5 rounded flex-shrink-0 tracking-wider ${TAG_STYLE[b.tag]}`}
            >
              {b.tag}
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}
