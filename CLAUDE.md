# Seb OS — Personal AI Dashboard

Dashboard personnel solo-utilisateur. On suit le guide "Personal OS Build
Cheat Sheet" de Miles Deutscher, adapté à mon contexte.

## Stack
- Next.js 15 (App Router), TypeScript strict, Tailwind v4
- Supabase (Postgres + pgvector), RLS deny-all, accès via service_role côté serveur
- Anthropic Claude (primaire) + OpenAI (fallback/Whisper/embeddings)
- Déploiement : Vercel

## Conventions
- Interface 100% en FRANÇAIS (fr-CA)
- Utilisateur unique : USER_ID="seb", fuseau America/Toronto
- Tous les calculs "quel jour est-on ?" passent par un helper localDateKey()
  qui utilise l'heure LOCALE, jamais UTC (sinon les resets se font à la mauvaise heure)
- daily_logs.notes est en TEXT contenant du JSON (pas jsonb) — faire JSON.parse
- Auth : cookie HMAC OU header x-api-secret pour l'accès programmatique
- Tokens couleur : ink-0..4, accent (vert/teal), ok/warn/danger — définis dans globals.css
- Polices : Fraunces (titres), Geist (corps), Geist Mono (chiffres)
- JAMAIS de .catch vide : toujours logger les erreurs serveur
- Valider chaque colonne NOT NULL avant un INSERT

## Tables (migration 0001_init.sql)
entities, raw_captures, tasks, daily_logs, memory_chunks (vector 1536), audit_log

## État d'avancement
- [x] Partie 3 — Foundation (Next.js + Supabase + auth + dashboard Home)
- [x] Partie 4 — Pipeline de capture (Telegram webhook + web capture + classificateur + embedding)
- [x] Partie 5 — Les 7 cartes (données réelles)
- [x] Partie 6 — Mémoire
- [x] Partie 7 — Déploiement + Telegram + cron (crons Vercel dans vercel.json : daily-digest 11h30, weekly-review dim 23h)

## Au-delà du plan initial
- Carte Objectifs : semaine + mois, date sentinelle, persistance Supabase
- CRM complet : Kanban 4 colonnes, Smart search Claude, drawer d'édition, drag entre colonnes
- Brain tab : "Ask my OS" (Claude + mémoire vectorielle) + recherche sémantique
- Finance Pulse : intégration patrimoine via le serveur Bourse externe (voir dossier `Bourse/tools`), stocks temps réel
- Login migré vers Server Action (src/app/login/actions.ts + SubmitButton.tsx) — remplace l'ancienne route /api/auth/login-form
- Page /review : bilan hebdomadaire navigable (captures par type, tâches complétées, tâches en retard, streak) — équivalent web du cron weekly-review, src/app/review/page.tsx

## Partie 4 — Notes d'implémentation
- lib/router/classifyCapture.ts : Claude (primaire) → OpenAI → regex
- lib/router/embedText.ts : OpenAI text-embedding-3-small (1536 dims)
- lib/router/pipeline.ts : classify → raw_captures → tasks (si kind=task) → memory_chunks → audit_log
- app/api/telegram/webhook/route.ts : vérifie x-telegram-bot-api-secret-token + TELEGRAM_USER_ID, transcrit OGG via Whisper, répond avec clavier urgence inline
- app/api/capture/route.ts : même pipeline, source='web'
- CaptureBox.tsx : flottante bas de page, ⌘↵ pour envoyer, toast de confirmation
- Embedding fire-and-forget (ne bloque pas la réponse)
- Pour Telegram : enregistrer le webhook via curl (voir guide Partie 7 Step 4)

## Partie 5 — Notes d'implémentation
- lib/data/dashboard.ts : localDateKey(), getOrCreateDailyLog(), getPendingTasks(), getStreak()
- daily_logs.notes JSON : { priority?: string; habits?: string[] }
- app/api/daily/route.ts : PATCH — merge + sauvegarde daily_log du jour
- app/api/tasks/route.ts : PATCH { id } — completed_at = now()
- OperatorCard : props focus + streak (server)
- KeyBlockersCard : client, tasks filtrées (key || today || this_week), bouton ✓ compléter
- SessionCard : client, initialPriority prop, ⌘↵ ou bouton → PATCH /api/daily
- HabitsCard : client, initialHabits prop, toggle → PATCH /api/daily
- CalendarCard : client, toutes les tâches pendantes triées urgence → affichage liste
- page.tsx : async server component, Promise.all([getOrCreateDailyLog, getPendingTasks, getStreak])

## Partie 6 — Notes d'implémentation
- SQL: match_memory_chunks(query_embedding, match_count, match_threshold) — à créer dans Supabase SQL Editor
- POST /api/memory/search : { q } → embed → rpc match_memory_chunks → { results }
- MemoryPalette.tsx : overlay ⌘K, debounce 350ms, navigation ↑↓, score de similarité affiché
- Telegram /recall <query> : recherche et répond avec les 5 meilleurs souvenirs (threshold 0.35)
- Telegram callback_query : boutons urgence (urgency:today:uuid) et clé (key:true:uuid)
  → met à jour tasks.urgency ou tasks.key via Supabase, répond avec answerCallbackQuery