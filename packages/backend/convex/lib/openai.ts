/**
 * Cliente OpenAI minimo via fetch (sin SDK): chat completions con tool
 * calling + embeddings. Se mantiene sin dependencias para que el runtime
 * de Convex lo ejecute sin fricciones.
 */

const OPENAI_BASE = 'https://api.openai.com/v1';

/** Modelo conversacional del agente. */
export const CHAT_MODEL = 'gpt-4.1';
/** Modelo de embeddings (1536 dims — debe coincidir con el vectorIndex). */
export const EMBEDDING_MODEL = 'text-embedding-3-small';

function apiKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('Configura OPENAI_API_KEY en Convex');
  return key;
}

export type ChatMessage =
  | { role: 'system' | 'user'; content: string }
  | {
      role: 'assistant';
      content: string | null;
      tool_calls?: ToolCall[];
    }
  | { role: 'tool'; tool_call_id: string; content: string };

export type ToolCall = {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
};

export type ToolDef = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export async function chatCompletion(args: {
  messages: ChatMessage[];
  tools?: ToolDef[];
  temperature?: number;
}): Promise<{ content: string | null; toolCalls: ToolCall[] }> {
  const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey()}`,
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      messages: args.messages,
      ...(args.tools && args.tools.length > 0
        ? { tools: args.tools, tool_choice: 'auto' }
        : {}),
      temperature: args.temperature ?? 0.6,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI chat ${res.status}: ${body.slice(0, 500)}`);
  }
  const json = (await res.json()) as {
    choices?: Array<{
      message?: { content?: string | null; tool_calls?: ToolCall[] };
    }>;
  };
  const msg = json.choices?.[0]?.message;
  return { content: msg?.content ?? null, toolCalls: msg?.tool_calls ?? [] };
}

/** Embeddings en lote (max ~2048 inputs por llamada; usamos lotes chicos). */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const res = await fetch(`${OPENAI_BASE}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey()}`,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: texts.map((t) => t.slice(0, 8000)),
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI embeddings ${res.status}: ${body.slice(0, 500)}`);
  }
  const json = (await res.json()) as {
    data: Array<{ index: number; embedding: number[] }>;
  };
  const sorted = [...json.data].sort((a, b) => a.index - b.index);
  return sorted.map((d) => d.embedding);
}
