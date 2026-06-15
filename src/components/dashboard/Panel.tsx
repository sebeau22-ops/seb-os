import type { ReactNode } from 'react';

type PanelProps = {
  index?: string;
  title?: string;
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
};

function SectionHeader({
  index,
  title,
  meta,
}: {
  index?: string;
  title?: string;
  meta?: ReactNode;
}) {
  return (
    <header className="flex items-center justify-between px-4 py-2.5 border-b border-ink-2 flex-shrink-0">
      <span className="font-mono text-[10px] uppercase tracking-[0.14em]">
        {index != null && <span className="text-accent">{index}</span>}
        {index != null && title != null && (
          <span className="text-ink-3"> // </span>
        )}
        {title != null && <span className="text-ink-3">{title}</span>}
      </span>
      {meta != null && (
        <span className="font-mono text-[10px]">{meta}</span>
      )}
    </header>
  );
}

export default function Panel({
  index,
  title,
  meta,
  children,
  className,
}: PanelProps) {
  const hasHeader = index != null || title != null;

  return (
    <div
      className={[
        'rounded-xl bg-ink-1/80 backdrop-blur-md border border-ink-2 overflow-hidden flex flex-col',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {hasHeader && (
        <SectionHeader index={index} title={title} meta={meta} />
      )}
      {children}
    </div>
  );
}
