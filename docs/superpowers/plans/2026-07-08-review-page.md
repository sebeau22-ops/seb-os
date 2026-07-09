# Page /review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `/review` page (Next.js App Router) — the web equivalent of the `weekly-review` Telegram cron, showing a navigable weekly bilan (captures by type, completed tasks, overdue tasks, streak).

**Architecture:** A new data layer (`src/lib/data/review.ts`) computes week boundaries and queries Supabase directly (server-side, no new API route). A new presentational component (`src/components/review/ReviewBoard.tsx`) renders the four `Panel` sections plus prev/next `Link` navigation. A new server component page (`src/app/review/page.tsx`) wires them together, reading the week offset from `searchParams`. Full rationale in `docs/superpowers/specs/2026-07-08-review-page-design.md`.

**Tech Stack:** Next.js 15 App Router (TypeScript strict), Supabase (`@supabase/supabase-js`), Tailwind v4 (existing `ink-*`/`accent`/`ok`/`warn`/`danger` tokens).

**Testing approach:** This project has no automated test runner (no jest/vitest in `package.json` — confirmed by inspection). Verification for each task is `npx tsc --noEmit -p tsconfig.json` (must pass with zero errors) plus, once the page exists, a `curl` against the running dev server (the route is behind auth middleware, so requests need the `x-api-secret` header — see Task 5 and 7). Do not introduce a test framework as part of this plan; it's out of scope per the spec.

---

### Task 1: Export `shiftDate` from the dashboard data layer

**Files:**
- Modify: `src/lib/data/dashboard.ts:10-15`

The new `review.ts` module needs the same "noon-UTC anchor" date-shifting helper already used by `dashboard.ts` (avoids DST bugs). It's currently private — export it instead of duplicating it.

- [ ] **Step 1: Add `export` to the `shiftDate` function**

In `src/lib/data/dashboard.ts`, change:

```ts
function shiftDate(dateStr: string, days: number): string {
```

to:

```ts
export function shiftDate(dateStr: string, days: number): string {
```

No other changes to the file — the function body stays exactly as-is.

- [ ] **Step 2: Verify the project still typechecks**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no output (zero errors).

- [ ] **Step 3: Commit**

```bash
git add src/lib/data/dashboard.ts
git commit -m "refactor: exporter shiftDate depuis dashboard.ts pour réutilisation"
```

---

### Task 2: `getWeekRange` in `src/lib/data/review.ts`

**Files:**
- Create: `src/lib/data/review.ts`

- [ ] **Step 1: Create the file with the week-range calculation**

```ts
import { db } from '@/lib/supabase';
import { localDateKey, shiftDate, getStreak } from '@/lib/data/dashboard';

const USER_ID = process.env.USER_ID ?? 'seb';

// ── Types ─────────────────────────────────────────────────────────────────────

export type WeekRange = {
  start: string;   // YYYY-MM-DD, lundi
  end: string;      // YYYY-MM-DD, dimanche
  label: string;    // "6 juil. – 12 juil. 2026"
};

// ── Plage de semaine ─────────────────────────────────────────────────────────

const DAY_MONTH_FMT = new Intl.DateTimeFormat('fr-CA', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

export function getWeekRange(weekOffset: number): WeekRange {
  const today = localDateKey();
  const dow = new Date(`${today}T12:00:00Z`).getUTCDay(); // 0=dim..6=sam
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const start = shiftDate(today, mondayOffset + weekOffset * 7);
  const end = shiftDate(start, 6);

  const startDate = new Date(`${start}T12:00:00Z`);
  const endDate = new Date(`${end}T12:00:00Z`);
  const label = `${DAY_MONTH_FMT.format(startDate)} – ${DAY_MONTH_FMT.format(endDate)} ${endDate.getUTCFullYear()}`;

  return { start, end, label };
}
```

This file will grow in Task 3 — leave it as-is for now.

- [ ] **Step 2: Verify typecheck passes**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no output (zero errors). `getStreak` is imported but unused until Task 3 — this project's `tsconfig.json` does not set `noUnusedLocals`, so an unused import is not a type error here (confirmed: only `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitReturns`, `noFallthroughCasesInSwitch` are enabled).

- [ ] **Step 3: Commit**

```bash
git add src/lib/data/review.ts
git commit -m "feat: getWeekRange — calcul de plage de semaine navigable"
```

---

### Task 3: `getWeeklyReview` in `src/lib/data/review.ts`

**Files:**
- Modify: `src/lib/data/review.ts`

- [ ] **Step 1: Append the aggregate query function and its types**

Add to the end of `src/lib/data/review.ts`:

```ts
export type CaptureBreakdown = { kind: string; count: number };

export type ReviewTask = {
  id: string;
  title: string;
  date: string; // completed_at (tâches complétées) ou created_at (tâches en retard), ISO
};

export type WeeklyReview = {
  weekOffset: number;
  label: string;
  captureTotal: number;
  captureBreakdown: CaptureBreakdown[];
  completedTasks: ReviewTask[];
  overdueTasks: ReviewTask[];
  streak: number;
};

const KIND_FALLBACK = 'capture';

export async function getWeeklyReview(weekOffset: number): Promise<WeeklyReview> {
  const { start, end, label } = getWeekRange(weekOffset);
  const rangeStart = `${start}T00:00:00Z`;
  const rangeEndExclusive = `${shiftDate(end, 1)}T00:00:00Z`;

  const [capturesRes, completedRes, overdueRes, streak] = await Promise.all([
    db
      .from('raw_captures')
      .select('classification')
      .eq('user_id', USER_ID)
      .gte('created_at', rangeStart)
      .lt('created_at', rangeEndExclusive),
    db
      .from('tasks')
      .select('id, title, completed_at')
      .eq('user_id', USER_ID)
      .gte('completed_at', rangeStart)
      .lt('completed_at', rangeEndExclusive)
      .order('completed_at', { ascending: false }),
    db
      .from('tasks')
      .select('id, title, created_at')
      .eq('user_id', USER_ID)
      .eq('urgency', 'today')
      .is('completed_at', null)
      .lt('created_at', rangeEndExclusive)
      .order('created_at', { ascending: true }),
    getStreak(),
  ]);

  if (capturesRes.error) console.error('[getWeeklyReview] raw_captures:', capturesRes.error.message);
  if (completedRes.error) console.error('[getWeeklyReview] completed tasks:', completedRes.error.message);
  if (overdueRes.error) console.error('[getWeeklyReview] overdue tasks:', overdueRes.error.message);

  const breakdownMap = new Map<string, number>();
  for (const c of capturesRes.data ?? []) {
    const classification = c.classification as { kind?: string } | null;
    const kind = classification?.kind ?? KIND_FALLBACK;
    breakdownMap.set(kind, (breakdownMap.get(kind) ?? 0) + 1);
  }
  const captureBreakdown = [...breakdownMap.entries()]
    .map(([kind, count]) => ({ kind, count }))
    .sort((a, b) => b.count - a.count);

  const completedTasks: ReviewTask[] = (completedRes.data ?? []).map((t) => ({
    id: t.id as string,
    title: t.title as string,
    date: t.completed_at as string,
  }));

  const overdueTasks: ReviewTask[] = (overdueRes.data ?? []).map((t) => ({
    id: t.id as string,
    title: t.title as string,
    date: t.created_at as string,
  }));

  return {
    weekOffset,
    label,
    captureTotal: (capturesRes.data ?? []).length,
    captureBreakdown,
    completedTasks,
    overdueTasks,
    streak,
  };
}
```

Note on the date range: `rangeStart`/`rangeEndExclusive` treat the local calendar-day boundary as if it were UTC midnight — this mirrors the exact approximation already used in `api/cron/weekly-review/route.ts` and `api/cron/daily-digest/route.ts` (both build week boundaries via `setUTCDate`/`toISOString`). Not perfectly correct for a UTC-4/5 timezone, but consistent with the rest of the codebase rather than introducing a second, different convention.

- [ ] **Step 2: Verify typecheck passes**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no output (zero errors).

Runtime behavior (actual Supabase query results, capture breakdown counts, empty states) is verified end-to-end in Task 5 Steps 3–5, once the page exists to render this data through — no standalone script here, since a throwaway script importing `@/lib/...`-aliased modules would need extra module-resolution setup (tsconfig `paths` aren't resolved by plain `node`/`tsx` without additional config) that isn't worth adding for a one-off check.

- [ ] **Step 3: Commit**

```bash
git add src/lib/data/review.ts
git commit -m "feat: getWeeklyReview — captures/tâches/streak pour une semaine donnée"
```

---

### Task 4: `ReviewBoard` presentational component

**Files:**
- Create: `src/components/review/ReviewBoard.tsx`

**Note:** this is a server component (no `'use client'` directive) — it only renders static markup and `Link`s, no hooks, no interactivity. Matches the design decision to avoid client-side fetching for this page.

- [ ] **Step 1: Create the component**

```tsx
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
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no output (zero errors).

- [ ] **Step 3: Commit**

```bash
git add src/components/review/ReviewBoard.tsx
git commit -m "feat: ReviewBoard — panels captures/complétées/retard/streak"
```

---

### Task 5: `/review` page

**Files:**
- Create: `src/app/review/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
import TopRail from '@/components/dashboard/TopRail';
import CaptureBox from '@/components/dashboard/CaptureBox';
import ReviewBoard from '@/components/review/ReviewBoard';
import { getWeeklyReview } from '@/lib/data/review';

interface Props {
  searchParams: Promise<{ week?: string }>;
}

export default async function ReviewPage({ searchParams }: Props) {
  const { week } = await searchParams;
  const raw = week !== undefined ? Number.parseInt(week, 10) : 0;
  const weekOffset = Number.isFinite(raw) && raw <= 0 ? raw : 0;

  const data = await getWeeklyReview(weekOffset);

  return (
    <div className="min-h-screen bg-ink-0 flex flex-col">
      <TopRail />
      <div className="flex-1 p-6 pb-24 max-w-2xl mx-auto w-full">
        <div className="mb-6">
          <p className="font-mono text-[10px] text-accent tracking-[0.2em] uppercase mb-1">REVIEW</p>
          <h1 className="font-mono text-[11px] text-ink-3 tracking-widest">
            Bilan hebdomadaire
          </h1>
        </div>
        <ReviewBoard data={data} />
      </div>
      <CaptureBox />
    </div>
  );
}
```

`weekOffset` defaults to `0` both when `week` is missing/non-numeric (`Number.isFinite` catches `NaN`) and when it's positive (blocks manually-edited future-week URLs) — matches the two edge cases in the spec ("semaine future bloquée" and "`week` invalide traité comme `0`").

- [ ] **Step 2: Verify typecheck passes**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no output (zero errors).

- [ ] **Step 3: Start the dev server and verify the page renders behind auth**

Run:
```bash
npm run dev &
sleep 4
API_SECRET=$(grep '^API_SECRET=' .env.local | cut -d '=' -f2-)
curl -s -H "x-api-secret: $API_SECRET" "http://localhost:3000/review?week=0" | grep -o "Bilan hebdomadaire"
```
Expected output: `Bilan hebdomadaire`

Then verify all four panel titles are present:
```bash
curl -s -H "x-api-secret: $API_SECRET" "http://localhost:3000/review?week=0" | grep -oE "CAPTURES|COMPLÉTÉES|EN RETARD|STREAK"
```
Expected output (4 lines, order may vary with grep -o but all 4 must appear):
```
CAPTURES
COMPLÉTÉES
EN RETARD
STREAK
```

- [ ] **Step 4: Verify the "next week" link is absent on the current week**

```bash
curl -s -H "x-api-secret: $API_SECRET" "http://localhost:3000/review?week=0" | grep -o "SEMAINE SUIV"
```
Expected: one match printed as plain text (not inside an `<a href>`) — confirms the disabled `<span>` branch rendered instead of a `Link`. To confirm it's genuinely not a link, check no `href="/review?week=1"` appears:
```bash
curl -s -H "x-api-secret: $API_SECRET" "http://localhost:3000/review?week=0" | grep -c 'week=1"'
```
Expected: `0`

- [ ] **Step 5: Verify navigating to a past week works and re-enables "next"**

```bash
curl -s -H "x-api-secret: $API_SECRET" "http://localhost:3000/review?week=-1" | grep -c 'week=0"'
```
Expected: `1` (the "next week" link back to the current week is present)

- [ ] **Step 6: Stop the dev server**

```bash
kill %1
```

- [ ] **Step 7: Commit**

```bash
git add src/app/review/page.tsx
git commit -m "feat: page /review — bilan hebdomadaire navigable"
```

---

### Task 6: Document the shipped feature in CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add a line to the "Au-delà du plan initial" section**

In `CLAUDE.md`, find:

```markdown
- Login migré vers Server Action (src/app/login/actions.ts + SubmitButton.tsx) — remplace l'ancienne route /api/auth/login-form
```

Add immediately after it:

```markdown
- Page /review : bilan hebdomadaire navigable (captures par type, tâches complétées, tâches en retard, streak) — équivalent web du cron weekly-review, src/app/review/page.tsx
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: documenter la page /review dans CLAUDE.md"
```

---

### Task 7: Full manual QA pass + production build

**Files:** none (verification only)

- [ ] **Step 1: Full production build**

Run: `npx next build`
Expected: build succeeds, `/review` appears in the route list output (as a dynamic `ƒ` route, since it reads `searchParams`).

- [ ] **Step 2: Clean the build artifacts**

```bash
rm -rf .next
```

- [ ] **Step 3: Manual browser walkthrough**

Run: `npm run dev`, then in a browser:
1. Log in, click the REVIEW tab in the top nav.
2. Confirm the current week's label, captures breakdown, completed/overdue task lists, and streak all render without console errors.
3. Click "← SEMAINE PRÉC." a few times; confirm the label updates and the lists change (or show the empty-state text for a week with no data).
4. Confirm "SEMAINE SUIV. →" reappears once you've navigated to a past week, and disappears again once back at the current week.
5. Open browser devtools console — confirm no errors were logged during navigation.

- [ ] **Step 4: Stop the dev server**

Press `Ctrl+C` in the terminal running `npm run dev`.

This task has no commit — it's verification of work already committed in Tasks 1–6.
