type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

const DEFAULT_GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
const DEFAULT_GROQ_MODEL = 'llama-3.3-70b-versatile';

function hasGroqConfig() {
  return Boolean(process.env.GROQ_API_KEY?.trim());
}

export async function completeWithGroq(
  messages: ChatMessage[],
  options: { temperature?: number; maxTokens?: number } = {},
): Promise<{ text: string; source: 'groq' } | null> {
  if (!hasGroqConfig()) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(`${(process.env.GROQ_BASE_URL || DEFAULT_GROQ_BASE_URL).replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL,
        messages,
        temperature: options.temperature ?? 0.4,
        max_tokens: options.maxTokens ?? 300,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = payload.choices?.[0]?.message?.content?.trim();

    if (!text) {
      return null;
    }

    return { text, source: 'groq' };
  } catch (error) {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export function groqIsConfigured() {
  return hasGroqConfig();
}
