import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

export type CaptureKind = 'task' | 'journal' | 'note' | 'decision' | 'capture';
export type Urgency = 'today' | 'this_week' | 'this_month' | 'someday';

export type Classification = {
  kind: CaptureKind;
  urgency: Urgency;
  entity_id: string | null;
  tags: string[];
  summary: string;
};

const SYSTEM_PROMPT = `Tu es un classificateur de captures personnelles en français.
Analyse le texte et retourne UNIQUEMENT un objet JSON valide, sans backticks, avec ces champs :
{
  "kind": "task" | "journal" | "note" | "decision" | "capture",
  "urgency": "today" | "this_week" | "this_month" | "someday",
  "entity_id": null,
  "tags": ["tag1", "tag2"],
  "summary": "Résumé court en français (max 120 car.)"
}

Règles de classification :
- "task" : action à accomplir (verbe d'action, todo, à faire, rappel, acheter, appeler, envoyer, préparer)
- "journal" : réflexion personnelle, humeur, ressenti, journalisation quotidienne
- "decision" : décision prise ou à prendre, choix à arbitrer
- "note" : information, référence, idée sans action directe
- "capture" : tout le reste
- entity_id : toujours null (résolu ultérieurement)
- Réponds UNIQUEMENT avec le JSON, rien d'autre.`;

function regexFallback(text: string): Classification {
  const lower = text.toLowerCase();
  const isTask =
    /\b(faire|rappel|todo|à faire|à appeler|à envoyer|rédiger|préparer|acheter|réserver|compléter|finir|vérifier)\b/.test(lower);
  const isJournal =
    /\b(je |j'ai|j'étais|aujourd'hui|ce matin|ce soir|j'aime|je pense|je ressens|mon humeur)\b/.test(lower);
  const isDecision =
    /\b(décide|décision|choisir|j'ai décidé|option|versus|vs\.)\b/.test(lower);

  const urgencyToday =
    /\b(aujourd'hui|ce soir|ce matin|urgent|asap|maintenant|tout de suite)\b/.test(lower);
  const urgencyWeek =
    /\b(cette semaine|avant vendredi|avant lundi|lundi prochain)\b/.test(lower);
  const urgencyMonth =
    /\b(ce mois|avant fin du mois|dans le mois)\b/.test(lower);

  const kind: CaptureKind = isDecision ? 'decision' : isTask ? 'task' : isJournal ? 'journal' : 'capture';
  const urgency: Urgency = urgencyToday
    ? 'today'
    : urgencyWeek
      ? 'this_week'
      : urgencyMonth
        ? 'this_month'
        : 'someday';

  return {
    kind,
    urgency,
    entity_id: null,
    tags: [],
    summary: text.slice(0, 120),
  };
}

function parseClassification(raw: string): Classification {
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const VALID_KINDS: CaptureKind[] = ['task', 'journal', 'note', 'decision', 'capture'];
  const VALID_URGENCIES: Urgency[] = ['today', 'this_week', 'this_month', 'someday'];

  return {
    kind: VALID_KINDS.includes(parsed.kind as CaptureKind) ? (parsed.kind as CaptureKind) : 'capture',
    urgency: VALID_URGENCIES.includes(parsed.urgency as Urgency) ? (parsed.urgency as Urgency) : 'someday',
    entity_id: null, // on ne fait jamais confiance au LLM pour les FK
    tags: Array.isArray(parsed.tags) ? (parsed.tags as string[]).slice(0, 5) : [],
    summary: typeof parsed.summary === 'string' ? parsed.summary.slice(0, 200) : String(parsed.summary ?? '').slice(0, 200),
  };
}

export async function classifyCapture(
  text: string,
): Promise<{ classification: Classification; llm_source: string }> {
  // ── 1. Anthropic Claude (primaire) ────────────────────────────────────────
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const model = process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001';
      const msg = await anthropic.messages.create({
        model,
        max_tokens: 256,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: text }],
      });
      const first = msg.content[0];
      const raw = first?.type === 'text' ? first.text.trim() : '';
      return { classification: parseClassification(raw), llm_source: 'anthropic' };
    } catch (err) {
      console.error('[classifyCapture] Anthropic échoué:', err);
    }
  }

  // ── 2. OpenAI (fallback) ──────────────────────────────────────────────────
  if (process.env.OPENAI_API_KEY) {
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const model = process.env.OPENAI_CLASSIFIER_MODEL ?? 'gpt-4o-mini';
      const res = await openai.chat.completions.create({
        model,
        max_tokens: 256,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: text },
        ],
      });
      const raw = (res.choices[0]?.message?.content) ?? '{}';
      return { classification: parseClassification(raw), llm_source: 'openai' };
    } catch (err) {
      console.error('[classifyCapture] OpenAI échoué:', err);
    }
  }

  // ── 3. Regex (dernier recours) ────────────────────────────────────────────
  return { classification: regexFallback(text), llm_source: 'regex' };
}
