# Page /review — Design

## Contexte

L'onglet "REVIEW" existe déjà dans la navigation (`TopRail.tsx`) et pointe vers
`/review`, mais aucune page n'a jamais été construite à cette route — c'est un
lien mort (404).

Deux crons existent déjà et envoient des bilans sur Telegram :
- `api/cron/daily-digest` — briefing du jour (focus, tâches today/semaine, streak)
- `api/cron/weekly-review` — bilan de la semaine (captures, tâches complétées,
  tâches en retard, streak)

Le nom de l'onglet REVIEW correspond au second. Cette page en est l'équivalent
web, navigable, avec plus de détail que ce qu'un message Telegram peut
raisonnablement afficher.

## Portée

- Bilan **hebdomadaire uniquement** (pas de daily-digest sur cette page).
- Semaine **navigable** (← semaine précédente / semaine suivante →), pas figée
  sur la semaine courante.
- Listes de tâches **complètes** (pas de limite à 5 comme sur Telegram).
- Captures : **total + répartition par type** (`task`, `journal`, `note`,
  `decision`, `capture`), pas juste un total.

Hors scope : modifier les crons Telegram existants, ajouter un daily-digest
web, permettre d'éditer des tâches depuis cette page (lecture seule).

## Architecture

### Route — composant serveur, pas de nouvelle API

`src/app/review/page.tsx` est un composant serveur (même modèle que
`src/app/page.tsx`, la home). La semaine affichée est pilotée par un
`searchParams.week` — un offset entier (`0` = semaine courante, `-1` =
précédente, etc., défaut `0` si absent ou invalide).

La navigation ← → est faite avec `<Link href="/review?week=N">` — pas de
fetch client, pas de state, pas de spinner de chargement. Chaque clic est une
navigation serveur normale de Next.js.

Le bouton "→" (semaine suivante) est désactivé/masqué quand
`weekOffset >= 0` — on ne peut pas naviguer vers une semaine future qui n'a
pas encore de données.

### Couche de données — `src/lib/data/review.ts`

Nouveau fichier, séparé de `dashboard.ts` (qui reste dédié aux données de la
home page). Il réutilise le pattern `shiftDate` (ancrage midi UTC pour éviter
les problèmes de DST) déjà présent dans `dashboard.ts`.

```ts
function getWeekRange(weekOffset: number): {
  start: string;   // YYYY-MM-DD, lundi
  end: string;      // YYYY-MM-DD, dimanche
  label: string;    // "6 – 12 juillet 2026"
}

type CaptureBreakdown = { kind: string; count: number }[];

type WeeklyReview = {
  weekOffset: number;
  label: string;
  captureTotal: number;
  captureBreakdown: CaptureBreakdown;
  completedTasks: { id: string; title: string; completed_at: string }[];
  overdueTasks: { id: string; title: string; urgency: string; created_at: string }[];
  streak: number;
};

async function getWeeklyReview(weekOffset: number): Promise<WeeklyReview>
```

`getWeeklyReview` fait les requêtes Supabase pour la plage `[start, end]` :
- `raw_captures` : `select('kind')` pour la semaine, puis groupement en JS
  (pas de `GROUP BY` côté supabase-js sans RPC dédiée — volume faible sur un
  usage solo, pas besoin d'agrégat SQL) → total + breakdown par `kind`
- `tasks` avec `completed_at` dans la plage → liste complète, triée
  `completed_at` **décroissant** (plus récent en premier, même ordre que le
  cron)
- `tasks` avec `urgency = 'today'`, `completed_at IS NULL`, `created_at < end`
  → liste complète (mêmes critères que le cron `weekly-review`, sans limite),
  triée `created_at` croissant (les plus anciennes en retard en premier)
- `getStreak()` réutilisé tel quel depuis `dashboard.ts` — c'est un streak
  global, indépendant de la semaine affichée (même valeur peu importe l'offset)

Cette logique s'inspire des requêtes déjà écrites dans
`api/cron/weekly-review/route.ts` sans les dupliquer bêtement dans un sens
"copier-coller" — mais les crons eux-mêmes ne sont pas modifiés (hors scope).

### UI — même charpente que `/finance` et `/crm`

```
TopRail
En-tête : "REVIEW" (font-mono, style existant) + ← [label semaine] →
Panel "CAPTURES"    → total + mini breakdown par type
Panel "COMPLÉTÉES"  → liste complète de la semaine (titre + date)
Panel "EN RETARD"   → liste complète (titre + depuis quand)
Panel "STREAK"      → tuile simple, nombre de jours
CaptureBox (bas de page, comme les autres tabs)
```

Réutilise `Panel.tsx` pour chaque section (même structure `index`/`title`/
`meta` que les autres cartes du dashboard). Tokens de couleur `ink-*`/
`accent`/`ok`/`warn`/`danger`, polices Fraunces/Geist/Geist Mono existantes.
Rien de nouveau au niveau du design system.

## Cas limites

- **Semaine sans données** : chaque panel affiche un état vide explicite
  ("Aucune capture cette semaine-là") plutôt qu'un panel vide silencieux.
- **`week` invalide dans l'URL** (non-numérique, etc.) : traité comme `0`
  (semaine courante).
- **Navigation future** : bloquée comme décrit plus haut.
- **Erreurs Supabase** : logger l'erreur côté serveur (convention du projet —
  jamais de `.catch` vide) et afficher un état vide plutôt que de faire
  planter la page.

## Testing

- Vérification manuelle en local (`npm run dev`) : naviguer /review, tester
  ← → sur plusieurs semaines, vérifier qu'une semaine sans données affiche
  bien les états vides, vérifier que "→" est désactivé sur la semaine
  courante.
- `tsc --noEmit` + `next build` doivent passer (pas de suite de tests
  automatisée dans ce projet à ce jour).
