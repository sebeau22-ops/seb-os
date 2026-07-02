import { type NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { localDateKey, getStreak } from '@/lib/data/dashboard';

const USER_ID = process.env.USER_ID ?? 'seb';
const TZ      = process.env.USER_TIMEZONE ?? 'America/Toronto';

function verifyCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET ?? '';
  if (!secret) return false;
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

function startOfWeekUTC(): string {
  const now = new Date();
  const dow = now.getUTCDay(); // 0 = dim
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

  const today      = localDateKey();
  const weekStart  = startOfWeekUTC();
  const dayLabel   = new Date().toLocaleDateString('fr-CA', {
    timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long',
  });

  // Tâches AUJOURD'HUI
  const { data: todayTasks } = await db
    .from('tasks')
    .select('title, key')
    .eq('user_id', USER_ID)
    .eq('urgency', 'today')
    .is('completed_at', null)
    .order('key', { ascending: false })
    .limit(5);

  // Tâches CETTE SEMAINE (hors aujourd'hui)
  const { data: weekTasks } = await db
    .from('tasks')
    .select('title, key')
    .eq('user_id', USER_ID)
    .eq('urgency', 'this_week')
    .is('completed_at', null)
    .limit(3);

  // Streak
  const streak = await getStreak();

  // Daily log — priorité du jour
  const { data: log } = await db
    .from('daily_logs')
    .select('notes')
    .eq('user_id', USER_ID)
    .eq('log_date', today)
    .maybeSingle();

  let priority = '';
  if (log?.notes) {
    try {
      const notes = JSON.parse(log.notes) as { priority?: string };
      priority = notes.priority ?? '';
    } catch { /* skip */ }
  }

  // Construire le message
  const lines: string[] = [];
  lines.push(`🌅 *Briefing du ${dayLabel}*\n`);

  if (priority) lines.push(`🎯 Focus : _${priority}_\n`);

  if (todayTasks && todayTasks.length > 0) {
    lines.push(`⚡ *Aujourd'hui (${todayTasks.length})*`);
    for (const t of todayTasks) {
      lines.push(`${t.key ? '🔑' : '▸'} ${t.title}`);
    }
    lines.push('');
  } else {
    lines.push('⚡ Aucune tâche pour aujourd\'hui\n');
  }

  if (weekTasks && weekTasks.length > 0) {
    lines.push(`📅 *Cette semaine*`);
    for (const t of weekTasks) {
      lines.push(`▸ ${t.title}`);
    }
    lines.push('');
  }

  lines.push(`🔥 Streak : *${streak} jour${streak > 1 ? 's' : ''}*`);
  lines.push(`\n💡 /recall pour chercher dans ta mémoire`);

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      chat_id:    chatId,
      text:       lines.join('\n'),
      parse_mode: 'Markdown',
    }),
  });

  console.log(`[cron/daily-digest] envoyé pour ${today}`);
  return NextResponse.json({ ok: true, date: today });
}
