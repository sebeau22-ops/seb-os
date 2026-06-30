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
- [ ] Partie 6 — Mémoire
- [ ] Partie 7 — Déploiement + Telegram + cron

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