import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase';

export async function GET() {
  // Test 1 : connexion Supabase
  const { data, error } = await db
    .from('raw_captures')
    .select('id')
    .limit(1);

  // Test 2 : insertion minimale
  const { data: ins, error: insErr } = await db
    .from('raw_captures')
    .insert({
      user_id: 'seb',
      source: 'debug',
      raw_text: 'test de connexion',
      audio_url: null,
      classification: { kind: 'capture', urgency: 'someday', entity_id: null, tags: [], summary: 'test' },
      llm_source: 'debug',
      routed_to: null,
      routed_id: null,
    })
    .select('id')
    .single();

  return NextResponse.json({
    select: { data, error },
    insert: { data: ins, error: insErr },
    env: {
      supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL?.slice(0, 30),
      has_service_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      has_anthropic: !!process.env.ANTHROPIC_API_KEY,
      has_openai: !!process.env.OPENAI_API_KEY,
    },
  });
}
