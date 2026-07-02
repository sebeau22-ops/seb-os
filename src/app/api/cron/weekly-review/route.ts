import { type NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { getStreak } from '@/lib/data/dashboard';

const USER_ID = process.env.USER_ID ?? 'seb';
const TZ      = process.env.USER_TIMEZONE ?? 'America/Toronto';

function verifyCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET ?? '';
  if (!secret) return false;
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

function startOfWeekISO(): string {
  const now = new Date();
  const dow = now.getUTCDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() + offset);
  monday.setUTCHours(0, 0, 0, 0);
  return monday.toISOString();
}

export async function GET(req: NextRequest) {
  if (!verifyCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId   = process.env.TELEGRAM_USER_ID;
  if (!botToken || !chatId) {
    return NextResponse.json({ error: 'Telegram non configuré' }, { status: 500 });
  }

  const weekStart = startOfWeekISO();
  const weekLabel = new Date().toLocaleDateString('fr-CA', {
    timeZone: TZ, day: 'numeric', month: 'long', year: 'numeric',
  });

  // Captures cette semaine
  const { count: captureCount } = await db
    .from('raw_captures')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', USER_ID)
    .gte('created_at', weekStart);

  // Tâches complétées cette semaine
  const { data: completedTasks } = await db
    .from('tasks')
    .select('title')
    .eq('user_id', USER_ID)
    .gte('completed_at', weekStart)
    .order('completed_at', { ascending: false })
    .limit(10);

  // Tâches en retard (today, non complétées, créées avant cette semaine)
  const { count: overdueCount } = await db
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', USER_ID)
    .eq('urgency', 'today')
    .is('completed_at', null)
    .lt('created_at', weekStart);

  // Streak
  const streak = await getStreak();

  const lines: string[] = [];
  lines.push(`📊 *Bilan de la semaine — ${weekLabel}*\n`);

  lines.push(`📥 Captures : *${captureCount ?? 0}*`);
  lines.push(`✅ Tâches complétées : *${completedTasks?.length ?? 0}*`);
  if ((overdueCount ?? 0) > 0) {
    lines.push(`⚠️ Tâches en retard : *${overdueCount}*`);
  }
  lines.push(`🔥 Streak : *${streak} jour${streak > 1 ? 's' : ''}*\n`);

  if (completedTasks && completedTasks.length > 0) {
    lines.push(`*Accomplissements :*`);
    for (const t of completedTasks.slice(0, 5)) {
      lines.push(`✓ ${t.title}`);
    }
    lines.push('');
  }

  lines.push(`🗓 Nouvelle semaine — définis tes priorités !`);

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      chat_id:    chatId,
      text:       lines.join('\n'),
      parse_mode: 'Markdown',
    }),
  });

  console.log('[cron/weekly-review] envoyé');
  return NextResponse.json({ ok: true });
}
