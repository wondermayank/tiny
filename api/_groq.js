// api/_groq.js — shared Groq helper (the leading underscore keeps Vercel from making it a route).
//
// Models the app can use. The browser only sends a key ("tiny", ...); the real Groq model id is
// looked up here, so nobody can ask your API key for an arbitrary model.
// Order matters: it is also the fallback order when the chosen model is unavailable.
export const MODELS = {
  'tiny':      { id: 'openai/gpt-oss-120b',     label: 'Tiny',          reasoning: true  },
  'tiny-lite': { id: 'openai/gpt-oss-20b',      label: 'Tiny Lite',     reasoning: true  },
  'llama-70b': { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B', reasoning: false },
  'llama-8b':  { id: 'llama-3.1-8b-instant',    label: 'Llama 3.1 8B',  reasoning: false },
};
export const DEFAULT_MODEL = 'tiny';

export function pickModel(key) {
  return MODELS[key] ? key : DEFAULT_MODEL;
}

// Calls the preferred model first, then the others. Returns { reply, key, label, fallback }.
// Throws an Error (with .status) only if every model fails.
export async function groqComplete({ apiKey, preferred, messages, temperature = 0.7, maxTokens = 600, json = false }) {
  const first = pickModel(preferred);
  const order = [first, ...Object.keys(MODELS).filter((k) => k !== first)];
  const errors = [];
  let lastStatus = 502;

  for (const key of order) {
    const m = MODELS[key];
    const payload = { model: m.id, messages, temperature };
    if (m.reasoning) {
      // GPT OSS models think first and those tokens count toward the limit, so leave extra room.
      payload.reasoning_effort = 'low';
      payload.max_completion_tokens = Math.max(maxTokens * 4, 2048);
    } else {
      payload.max_tokens = maxTokens;
    }
    if (json) payload.response_format = { type: 'json_object' };

    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        lastStatus = res.status;
        errors.push(`${m.label}: ${data?.error?.message || 'HTTP ' + res.status}`);
        continue;
      }
      const reply = data?.choices?.[0]?.message?.content?.trim();
      if (!reply) {
        errors.push(`${m.label}: empty response`);
        continue;
      }
      return { reply, key, label: m.label, fallback: key !== first };
    } catch (e) {
      errors.push(`${m.label}: network error`);
    }
  }

  const err = new Error('No AI model could answer right now. ' + errors.join(' | '));
  err.status = lastStatus >= 400 && lastStatus < 600 ? lastStatus : 502;
  throw err;
}
