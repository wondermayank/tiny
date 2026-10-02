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

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

function buildPayload(m, { messages, temperature, maxTokens, json, stream }) {
  const payload = { model: m.id, messages, temperature };
  if (m.reasoning) {
    // GPT OSS models think first and those tokens count toward the limit, so leave extra room.
    payload.reasoning_effort = 'low';
    payload.max_completion_tokens = Math.max(maxTokens * 4, 2048);
  } else {
    payload.max_tokens = maxTokens;
  }
  if (json) payload.response_format = { type: 'json_object' };
  if (stream) payload.stream = true;
  return payload;
}

// 401/403 mean the API key itself is wrong or blocked. Every other model would fail the same
// way, so we stop instead of burning time (and hiding the real problem behind a model fallback).
function isAuthStatus(status) {
  return status === 401 || status === 403;
}

function authError(status, detail) {
  console.error(`[groq] auth failure (HTTP ${status}): ${detail}`);
  const err = new Error('The AI service is not set up correctly right now. Please tell the site owner.');
  err.status = 500;
  return err;
}

function allFailedError(errors, lastStatus) {
  // The full list goes to the server log; the browser gets a short, readable message.
  console.error('[groq] every model failed: ' + errors.join(' | '));
  const err = new Error('No AI model could answer right now. Please try again in a minute.');
  err.status = lastStatus >= 400 && lastStatus < 600 ? lastStatus : 502;
  return err;
}

function modelOrder(preferred) {
  const first = pickModel(preferred);
  return { first, order: [first, ...Object.keys(MODELS).filter((k) => k !== first)] };
}

// Calls the preferred model first, then the others. Returns { reply, key, label, fallback }.
// Throws an Error (with .status) only if every model fails (or the API key is rejected).
export async function groqComplete({ apiKey, preferred, messages, temperature = 0.7, maxTokens = 600, json = false }) {
  const { first, order } = modelOrder(preferred);
  const errors = [];
  let lastStatus = 502;

  for (const key of order) {
    const m = MODELS[key];
    try {
      const res = await fetch(GROQ_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(buildPayload(m, { messages, temperature, maxTokens, json })),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = data?.error?.message || 'HTTP ' + res.status;
        if (isAuthStatus(res.status)) throw authError(res.status, detail);
        lastStatus = res.status;
        errors.push(`${m.label}: ${detail}`);
        continue;
      }
      const reply = data?.choices?.[0]?.message?.content?.trim();
      if (!reply) {
        errors.push(`${m.label}: empty response`);
        continue;
      }
      return { reply, key, label: m.label, fallback: key !== first };
    } catch (e) {
      if (e.status) throw e; // our own auth error — don't swallow it
      errors.push(`${m.label}: network error`);
    }
  }

  throw allFailedError(errors, lastStatus);
}

// Same fallback logic, but asks Groq for a streamed response. Resolves as soon as one model has
// accepted the request, with { body, key, label, fallback } where body is the raw SSE stream.
export async function groqOpenStream({ apiKey, preferred, messages, temperature = 0.7, maxTokens = 600 }) {
  const { first, order } = modelOrder(preferred);
  const errors = [];
  let lastStatus = 502;

  for (const key of order) {
    const m = MODELS[key];
    try {
      const res = await fetch(GROQ_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(buildPayload(m, { messages, temperature, maxTokens, stream: true })),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const detail = data?.error?.message || 'HTTP ' + res.status;
        if (isAuthStatus(res.status)) throw authError(res.status, detail);
        lastStatus = res.status;
        errors.push(`${m.label}: ${detail}`);
        continue;
      }
      if (!res.body) {
        errors.push(`${m.label}: no stream`);
        continue;
      }
      return { body: res.body, key, label: m.label, fallback: key !== first };
    } catch (e) {
      if (e.status) throw e;
      errors.push(`${m.label}: network error`);
    }
  }

  throw allFailedError(errors, lastStatus);
}

// Reads Groq's server-sent events and calls onText(chunk) for every piece of the final answer
// (reasoning tokens are ignored). Resolves with the full text.
export async function readGroqStream(body, onText, signal) {
  const reader = body.getReader();
  if (signal) signal.addEventListener('abort', () => reader.cancel().catch(() => {}), { once: true });
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';

  const handleLine = (line) => {
    line = line.trim();
    if (!line.startsWith('data:')) return;
    const data = line.slice(5).trim();
    if (!data || data === '[DONE]') return;
    let json;
    try { json = JSON.parse(data); } catch { return; }
    if (json.error) throw new Error(json.error.message || 'Stream error');
    const piece = json?.choices?.[0]?.delta?.content;
    if (piece) {
      full += piece;
      onText(piece);
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      handleLine(buffer.slice(0, nl));
      buffer = buffer.slice(nl + 1);
    }
  }
  if (buffer) handleLine(buffer);
  return full;
}
