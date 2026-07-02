import { db } from '@/lib/supabase';
import { classifyCapture } from '@/lib/router/classifyCapture';
import { embedText } from '@/lib/router/embedText';

const USER_ID = process.env.USER_ID ?? 'seb';

export type PipelineSource = 'telegram' | 'web' | 'api';

type PipelineInput = {
  text: string;
  source: PipelineSource;
  audio_url?: string;
};

export type PipelineResult = {
  capture_id: string;
  kind: string;
  urgency: string;
  summary: string;
  routed_to: string | null;
  routed_id: string | null;
};

export async function runPipeline(input: PipelineInput): Promise<PipelineResult> {
  const { text, source, audio_url } = input;

  // ── 1. Classifier ─────────────────────────────────────────────────────────
  const { classification, llm_source } = await classifyCapture(text);
  const { kind, urgency, entity_id, tags, summary } = classification;

  // ── 2. Écrire raw_captures ────────────────────────────────────────────────
  const { data: capture, error: captureError } = await db
    .from('raw_captures')
    .insert({
      user_id: USER_ID,
      source,
      raw_text: text,
      audio_url: audio_url ?? null,
      classification: { kind, urgency, entity_id, tags, summary },
      llm_source,
      routed_to: null,
      routed_id: null,
    })
    .select('id')
    .single();

  if (captureError ?? !capture) {
    console.error('[pipeline] raw_captures insert échoué:', captureError);
    throw new Error('Échec de sauvegarde de la capture');
  }

  const capture_id = capture.id as string;
  let routed_to: string | null = null;
  let routed_id: string | null = null;

  // ── 3. Routage vers la table aval ─────────────────────────────────────────
  if (kind === 'task') {
    // tasks.title est NOT NULL — on utilise summary (toujours défini)
    const { data: task, error: taskError } = await db
      .from('tasks')
      .insert({
        user_id: USER_ID,
        title: summary,
        description: text !== summary ? text : null,
        urgency,
        key: false,
        priority_score: 0,
        tags: tags.length > 0 ? tags : null,
        entity_id: entity_id ?? null,
      })
      .select('id')
      .single();

    if (taskError) {
      console.error('[pipeline] tasks insert échoué:', taskError);
    } else if (task) {
      routed_to = 'tasks';
      routed_id = task.id as string;
    }
  }
  // journal / note / decision / capture → restent dans raw_captures uniquement

  // Mise à jour de routed_to / routed_id dans raw_captures
  if (routed_to && routed_id) {
    const { error: updateError } = await db
      .from('raw_captures')
      .update({ routed_to, routed_id })
      .eq('id', capture_id);
    if (updateError) {
      console.error('[pipeline] raw_captures update routed échoué:', updateError);
    }
  }

  // ── 4. Embedding + memory_chunks (synchrone — Vercel coupe les fire-and-forget) ──
  const embedding = await embedText(summary);
  if (embedding) {
    const { error } = await db.from('memory_chunks').insert({
      user_id: USER_ID,
      source_type: 'capture',
      source_id: capture_id,
      text: summary,
      embedding: `[${embedding.join(',')}]`,
    });
    if (error) console.error('[pipeline] memory_chunks insert échoué:', error);
  }

  // ── 5. Audit log (fire-and-forget) ───────────────────────────────────────
  void db.from('audit_log').insert({
    user_id: USER_ID,
    action: 'capture',
    resource_type: routed_to ?? 'raw_capture',
    resource_id: (routed_id ?? capture_id) as unknown as string,
    metadata: { source, kind, urgency, llm_source },
  }).then(({ error }) => {
    if (error) console.error('[pipeline] audit_log insert échoué:', error);
  });

  return { capture_id, kind, urgency, summary, routed_to, routed_id };
}
