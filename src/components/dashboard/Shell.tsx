import type { ReactNode } from 'react';

type ShellProps = {
  topRail: ReactNode;
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
};

export default function Shell({ topRail, left, center, right }: ShellProps) {
  return (
    <div className="min-h-screen bg-ink-0 flex flex-col">
      {topRail}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[300px_1fr_340px] gap-3 p-3 items-start">
        <div className="flex flex-col gap-3">{left}</div>
        <div className="flex flex-col gap-3">{center}</div>
        <div className="flex flex-col gap-3">{right}</div>
      </div>
    </div>
  );
}
