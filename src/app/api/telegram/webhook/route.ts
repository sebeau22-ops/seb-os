import { type NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { runPipeline } from '@/lib/router/pipeline';
import { embedText } from '@/lib/router/embedText';
import { db } from '@/lib/supabase';

// ── Helper Telegram API ───────────────────────────────────────────────────────

async function telegramApi(
  token: string,
  method: string,
  body: Record<string, unknown>,
): Promise<void> {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.error(`[telegram] ${method} échoué:`, await res.text());
  }
}

// ── Transcription Whisper ─────────────────────────────────────────────────────

async function transcribeVoice(fileId: string, botToken: string): Promise<string> {
  // 1. Récupérer le chemin du fichier depuis Telegram
  const fileRes = await fetch(
    `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`,
  );
  if (!fileRes.ok) throw new Error('getFile échoué');
  const fileData = (await fileRes.json()) as { result?: { file_path?: string } };
  const filePath = fileData.result?.file_path;
  if (!filePath) throw new Error('file_path introuvable');

  // 2. Télécharger le fichier OGG
  const audioRes = await fetch(
    `https://api.telegram.org/file/bot${botToken}/${filePath}`,
  );
  if (!audioRes.ok) throw new Error('Téléchargement audio échoué');
  const audioBlob = await audioRes.blob();

  // 3. Transcrire avec Whisper — OGG avec bon MIME type
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const audioFile = new File([audioBlob], 'audio.ogg', { type: 'audio/ogg' });
  const transcription = await openai.audio.transcriptions.create({
    file: audioFile,
    model: 'whisper-1',
    language: 'fr',
  });
  return transcription.text.trim();
}

// ── Labels i18n ───────────────────────────────────────────────────────────────

const KIND_LABEL: Record<string, string> = {
  task: 'Tâche',
  journal: 'Journal',
  note: 'Note',
  decision: 'Décision',
  capture: 'Capture',
};

const URGENCY_LABEL: Record<string, string> = {
  today: "Aujourd'hui",
  this_week: 'Cette semaine',
  this_month: 'Ce mois-ci',
  someday: 'Un jour',
};

// ── Commande /recall — recherche sémantique ───────────────────────────────────

type MemoryResult = {
  chunk_text: string;
  source_type: string;
  similarity: number;
};

async function handleRecall(
  query: string,
  chatId: unknown,
  botToken: string,
): Promise<void> {
  if (!query.trim()) {
    await telegramApi(botToken, 'sendMessage', {
      chat_id: chatId,
      text: '🔍 Usage: /recall <ta question>',
    });
    return;
  }

  const embedding = await embedText(query);
  if (!embedding) {
    await telegramApi(botToken, 'sendMessage', {
      chat_id: chatId,
      text: '❌ Recherche indisponible (clé OpenAI manquante).',
    });
    return;
  }

  const { data, error } = await db.rpc('match_memory_chunks', {
    query_embedding: embedding as unknown as string,
    match_count:     5,
    match_threshold: 0.35,
  });

  if (error || !data || (data as MemoryResult[]).length === 0) {
    await telegramApi(botToken, 'sendMessage', {
      chat_id: chatId,
      text: '🔍 Aucun souvenir trouvé pour cette requête.',
    });
    return;
  }

  const lines = (data as MemoryResult[]).map((r, i) => {
    const pct = Math.round(r.similarity * 100);
    return `${i + 1}. [${pct}%] ${r.chunk_text}`;
  });

  await telegramApi(botToken, 'sendMessage', {
    chat_id: chatId,
    text: `🧠 *Mémoire — « ${query} »*\n\n${lines.join('\n\n')}`,
    parse_mode: 'Markdown',
  });
}

// ── Webhook handler ───────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const botToken      = process.env.TELEGRAM_BOT_TOKEN;
  const allowedUserId = process.env.TELEGRAM_USER_ID;

  // 1. Vérifier le secret Telegram
  if (webhookSecret) {
    const incoming = req.headers.get('x-telegram-bot-api-secret-token') ?? '';
    if (incoming !== webhookSecret) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  if (!botToken) {
    return NextResponse.json({ error: 'Bot non configuré' }, { status: 500 });
  }

  let update: Record<string, unknown>;
  try {
    update = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }

  // ── Callback query (boutons urgence / clé) ─────────────────────────────────
  const callbackQuery = update.callback_query as Record<string, unknown> | undefined;
  if (callbackQuery) {
    const cbFrom   = callbackQuery.from as Record<string, unknown>;
    const cbFromId = String(cbFrom?.id ?? '');
    if (allowedUserId && cbFromId !== allowedUserId) {
      return NextResponse.json({ ok: true });
    }

    const cbData   = (callbackQuery.data as string | undefined) ?? '';
    const cbChatId = (callbackQuery.message as Record<string, unknown> | undefined)?.chat
      ? ((callbackQuery.message as Record<string, unknown>).chat as Record<string, unknown>).id
      : undefined;
    const callbackId = callbackQuery.id as string;

    const parts = cbData.split(':'); // urgency:today:uuid  OR  key:true:uuid
    const action = parts[0];
    const value  = parts[1] ?? '';
    const captureId = parts[2] ?? '';

    if ((action === 'urgency' || action === 'key') && captureId) {
      // Trouver la tâche associée
      const { data: capture } = await db
        .from('raw_captures')
        .select('routed_to, routed_id')
        .eq('id', captureId)
        .maybeSingle();

      if (capture?.routed_to === 'tasks' && capture.routed_id) {
        if (action === 'urgency') {
          await db.from('tasks').update({ urgency: value }).eq('id', capture.routed_id);
        } else {
          await db.from('tasks').update({ key: value === 'true' }).eq('id', capture.routed_id);
        }
      }
    }

    // Acquitter le callback Telegram (supprime le spinner)
    await telegramApi(botToken, 'answerCallbackQuery', {
      callback_query_id: callbackId,
      text: action === 'urgency' ? `⏰ Urgence mise à jour` : `🔑 Tâche marquée clé`,
    });

    if (cbChatId) {
      await telegramApi(botToken, 'sendMessage', {
        chat_id: cbChatId,
        text: action === 'urgency'
          ? `✅ Urgence → ${URGENCY_LABEL[value] ?? value}`
          : '✅ Tâche marquée comme clé',
      });
    }

    return NextResponse.json({ ok: true });
  }

  const message = update.message as Record<string, unknown> | undefined;
  if (!message) return NextResponse.json({ ok: true });

  const chat   = message.chat as Record<string, unknown>;
  const from   = message.from as Record<string, unknown>;
  const chatId = chat?.id;
  const fromId = String(from?.id ?? '');
  const msgId  = message.message_id as number;

  // 2. Vérifier l'identité de l'expéditeur
  if (allowedUserId && fromId !== allowedUserId) {
    return NextResponse.json({ ok: true }); // silencieux pour les inconnus
  }

  let text = (message.text as string | undefined) ?? '';

  // 3. Message vocal → Whisper
  const voice = message.voice as Record<string, unknown> | undefined;
  if (voice) {
    if (!process.env.OPENAI_API_KEY) {
      await telegramApi(botToken, 'sendMessage', {
        chat_id: chatId,
        reply_to_message_id: msgId,
        text: '❌ Clé OpenAI manquante — transcription impossible.',
      });
      return NextResponse.json({ ok: true });
    }
    try {
      const fileId = voice.file_id as string;
      text = await transcribeVoice(fileId, botToken);
    } catch (err) {
      console.error('[telegram/webhook] transcription échouée:', err);
      await telegramApi(botToken, 'sendMessage', {
        chat_id: chatId,
        reply_to_message_id: msgId,
        text: '❌ Transcription échouée. Réessaie ou envoie du texte directement.',
      });
      return NextResponse.json({ ok: true });
    }
  }

  if (!text.trim()) return NextResponse.json({ ok: true });

  // 3b. Commande /recall — recherche dans la mémoire vectorielle
  if (text.startsWith('/recall')) {
    const query = text.replace('/recall', '').trim();
    await handleRecall(query, chatId, botToken);
    return NextResponse.json({ ok: true });
  }

  // 4–9. Pipeline + réponse avec clavier urgence
  try {
    const result = await runPipeline({ text, source: 'telegram' });

    const kindLabel    = KIND_LABEL[result.kind] ?? result.kind;
    const urgencyLabel = URGENCY_LABEL[result.urgency] ?? result.urgency;
    const feminine     = result.kind === 'task' || result.kind === 'decision' || result.kind === 'capture';

    const confirmText =
      `✅ *${kindLabel}* enregistré${feminine ? 'e' : ''}\n` +
      `📋 ${result.summary}\n` +
      `⏰ ${urgencyLabel}`;

    // Clavier inline pour modifier l'urgence
    const keyboard = {
      inline_keyboard: [
        [
          { text: "⚡ Aujourd'hui",  callback_data: `urgency:today:${result.capture_id}` },
          { text: '📅 Cette sem.',   callback_data: `urgency:this_week:${result.capture_id}` },
        ],
        [
          { text: '📆 Ce mois',      callback_data: `urgency:this_month:${result.capture_id}` },
          { text: '🗓 Un jour',       callback_data: `urgency:someday:${result.capture_id}` },
          { text: '🔑 Clé',          callback_data: `key:true:${result.capture_id}` },
        ],
      ],
    };

    await telegramApi(botToken, 'sendMessage', {
      chat_id: chatId,
      reply_to_message_id: msgId,
      text: confirmText,
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  } catch (err) {
    console.error('[telegram/webhook] pipeline échoué:', err);
    await telegramApi(botToken, 'sendMessage', {
      chat_id: chatId,
      reply_to_message_id: msgId,
      text: "❌ Erreur lors de l'enregistrement. Réessaie.",
    });
  }

  return NextResponse.json({ ok: true });
}
