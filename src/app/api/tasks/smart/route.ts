import { type NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { db } from '@/lib/supabase';

const USER_ID  = process.env.USER_ID ?? 'seb';
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const { query } = await req.json() as { query: string };
  if (!query?.trim()) return NextResponse.json([]);

  const { data: tasks, error } = await db
    .from('tasks')
    .select('id, title, urgency, key, tags')
    .eq('user_id', USER_ID)
    .is('completed_at', null);

  if (error || !tasks?.length) return NextResponse.json([]);

  try {
    const msg = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: `Voici mes tâches :\n${JSON.stringify(tasks, null, 2)}\n\nRequête : "${query}"\n\nRetourne UNIQUEMENT un tableau JSON des IDs de tâches les plus pertinentes (max 10), triées par pertinence. Aucune explication.`,
      }],
    });

    const text = msg.content[0]?.type === 'text' ? msg.content[0].text : '[]';
    const match = text.match(/\[[\s\S]*\]/);
    const ids: string[] = match ? (JSON.parse(match[0]) as string[]) : [];

    const results = ids
      .map(id => tasks.find(t => t.id === id))
      .filter(Boolean);

    return NextResponse.json(results);
  } catch (err) {
    console.error('[/api/tasks/smart]:', err);
    return NextResponse.json([]);
  }
}
