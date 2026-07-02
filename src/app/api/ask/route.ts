import { type NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { embedText } from '@/lib/router/embedText';
import { db } from '@/lib/supabase';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

type MemoryChunk = {
  id: string;
  source_type: string;
  source_id: string;
  chunk_text: string;
  similarity: number;
};

export async function POST(req: NextRequest) {
  const { q } = await req.json() as { q: string };
  if (!q?.trim()) return NextResponse.json({ error: 'q requis' }, { status: 400 });

  // 1. Embed the question
  const embedding = await embedText(q);
  if (!embedding) return NextResponse.json({ error: 'embedding échoué' }, { status: 500 });

  // 2. Top 20 chunks les plus proches
  const { data: chunks, error } = await db.rpc('match_memory_chunks', {
    query_embedding: embedding as unknown as string,
    match_count: 20,
    match_threshold: 0.3,
  });

  if (error) console.error('[/api/ask] match_memory_chunks:', error);

  if (!chunks?.length) {
    return NextResponse.json({
      answer: "Je n'ai pas encore assez de mémoire pour répondre à cette question. Fais quelques captures via Telegram ou la CaptureBox.",
      sources: [],
    });
  }

  const typedChunks = chunks as MemoryChunk[];

  // 3. Construire le contexte (max 800 chars par chunk)
  const contextStr = typedChunks
    .map((c, i) =>
      `[${i + 1}] Type : ${c.source_type} | Similarité : ${Math.round(c.similarity * 100)}%\n${c.chunk_text.slice(0, 800)}`,
    )
    .join('\n\n---\n\n');

  // 4. Appel Claude
  const msg = await anthropic.messages.create({
    model: process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: `Tu es l'assistant personnel de l'utilisateur. Réponds à sa question EN UTILISANT UNIQUEMENT le contexte de mémoire fourni. Cite les sources par leur numéro entre crochets [1], [2], etc. Si le contexte est insuffisant, dis-le clairement. Réponds en français, de façon concise et directe.`,
    messages: [{
      role: 'user',
      content: `Contexte (mémoire personnelle) :\n\n${contextStr}\n\n---\n\nQuestion : ${q}`,
    }],
  });

  const answer = msg.content[0]?.type === 'text'
    ? msg.content[0].text
    : 'Impossible de générer une réponse.';

  return NextResponse.json({
    answer,
    sources: typedChunks.slice(0, 5).map(c => ({
      id:         c.source_id,
      type:       c.source_type,
      text:       c.chunk_text.slice(0, 200),
      similarity: c.similarity,
    })),
  });
}
