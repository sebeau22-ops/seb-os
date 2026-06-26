import OpenAI from 'openai';

// Retourne un vecteur de 1536 dimensions, ou null si pas de clé / erreur.
export async function embedText(text: string): Promise<number[] | null> {
  if (!process.env.OPENAI_API_KEY) return null;
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const res = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text.slice(0, 8000),
    });
    return res.data[0]?.embedding ?? null;
  } catch (err) {
    console.error('[embedText] échoué:', err);
    return null;
  }
}
