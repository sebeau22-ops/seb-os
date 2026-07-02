'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { id: 'home',    label: 'HOME',    href: '/' },
  { id: 'crm',     label: 'CRM',     href: '/crm' },
  { id: 'finance', label: 'FINANCE', href: '/finance' },
  { id: 'review',  label: 'REVIEW',  href: '/review' },
] as const;

export default function TopRail() {
  const pathname = usePathname();
  const [time, setTime]     = useState('--:--:--');
  const [dateStr, setDateStr] = useState('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('fr-CA', { hour12: false }));
      setDateStr(
        now
          .toLocaleDateString('fr-CA', { weekday: 'short', month: 'short', day: 'numeric' })
          .toUpperCase(),
      );
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <nav className="sticky top-0 z-50 h-14 flex items-center justify-between px-4 border-b border-ink-2 bg-ink-0/95 backdrop-blur-md flex-shrink-0">
      {/* Marque */}
      <div className="flex items-center gap-2 min-w-[160px]">
        <span className="w-2 h-2 rounded-full bg-ok flex-shrink-0 animate-pulse" />
        <span className="font-mono text-[11px] tracking-widest text-ink-4">
          SEB OS <span className="text-ink-3">// V1.0</span>
        </span>
      </div>

      {/* Onglets */}
      <div className="hidden md:flex items-center gap-0.5">
        {TABS.map((tab) => {
          const active = tab.href === '/'
            ? pathname === '/'
            : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={`font-mono text-[10px] tracking-[0.2em] px-4 py-1.5 rounded-md transition-colors ${
                active
                  ? 'bg-accent/15 text-accent'
                  : 'text-ink-3 hover:text-ink-4'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* Date + horloge + avatar */}
      <div className="flex items-center gap-3 min-w-[160px] justify-end">
        <div className="hidden sm:flex flex-col items-end leading-none gap-0.5">
          <span className="font-mono text-[9px] text-ink-3 tracking-wider">{dateStr}</span>
          <span className="font-numeric text-[11px] text-ink-4">{time}</span>
        </div>
        <div className="w-8 h-8 rounded-full bg-accent/15 border border-accent/40 flex items-center justify-center flex-shrink-0">
          <span className="font-mono text-[10px] font-bold text-accent">SE</span>
        </div>
      </div>
    </nav>
  );
}
