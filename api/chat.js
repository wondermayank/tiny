// api/chat.js — Vercel serverless function
// Calls Groq's OpenAI-compatible chat completions endpoint and streams the answer back to the
// browser as newline-delimited JSON:
//   {"type":"meta","model":...,"label":...,"fallback":bool}   (first line)
//   {"type":"delta","text":"..."}                              (many)
//   {"type":"done"} or {"type":"error","error":"..."}           (last line)
// Errors that happen before streaming starts are a normal JSON error response.
// Requires env var GROQ_API_KEY set in the Vercel project settings.
import { groqOpenStream, readGroqStream } from './_groq.js';

function buildSystemPrompt(profile, settings) {
  const name = (profile && profile.name && String(profile.name).slice(0, 40)) || 'there';
  const gender = profile && profile.gender; // 'girl' | 'boy' | 'other' | undefined
  const tone = (settings && settings.tone) || 'friendly'; // 'friendly' | 'formal'
  const type = (settings && settings.type) || 'balanced'; // 'short' | 'balanced' | 'detailed'

  const toneLine = tone === 'formal'
    ? 'Speak in a polite, exam-coach register — clear and respectful, minimal slang.'
    : 'Speak like a supportive senior/friend — warm, encouraging, plain language, light and never robotic.';

  const lengthLine = {
    short: 'Keep every answer to 2-4 sentences unless the student explicitly asks for more detail.',
    balanced: 'Keep answers focused — a short paragraph or a tight bulleted list. Expand only if asked.',
    detailed: 'Give thorough, well-structured answers with examples when useful.',
  }[type] || 'Keep answers focused — a short paragraph or a tight bulleted list.';

  let periodGuidance = '';
  if (gender === 'girl') {
    periodGuidance = `
If ${name} asks about periods/menstruation, answer as a knowledgeable, warm female health guide would:
- Explain simply what's happening in the body (uterine lining shedding, hormone shifts) and that it's a normal, healthy process.
- Common symptoms: cramps, mood changes, fatigue, bloating — normal within a wide range.
- What helps: rest, a warm compress or heating pad on the lower abdomen, staying hydrated, light movement/stretching, a balanced diet, changing pads/tampons/cups regularly for hygiene, and OTC pain relief like ibuprofen or paracetamol used as directed on the packaging if needed.
- What to avoid: skipping meals, ignoring very heavy pain, poor hygiene (not changing protection for too long).
- When to see a doctor: periods that stop unexpectedly, extremely heavy bleeding, pain so severe it stops daily activity, or anything that feels very different from her normal cycle — encourage talking to a parent/guardian or doctor, not just self-managing.
- Tone: matter-of-fact and reassuring, like an older sister — never clinical-cold, never awkward or evasive.`;
  } else if (gender === 'boy') {
    periodGuidance = `
If ${name} asks about periods/menstruation (his own curiosity, or because a friend/sister/classmate is going through it), keep the biology explanation brief (a few sentences: it's the normal monthly shedding of the uterine lining, roughly monthly, can come with cramps/mood/fatigue) and spend more of the answer on how he can be genuinely helpful and respectful: offer to carry her bag, don't make jokes or comments about it, offer a warm drink or let her rest, don't pressure her about missed class/activity, keep it private and not a topic to gossip about, and just ask "do you need anything?" rather than assuming. Keep the tone practical and non-awkward — like advice from a good older brother.`;
  }

  return `You are the ThunderStudy AI Assistant — "Your Smart Study Companion" — built by Wondermayank for students preparing for CUET, JEE, NEET, SSC, Banking, CAT, CLAT, and other Indian competitive exams.

You're talking to ${name}.
${toneLine}
${lengthLine}

Your job: help with study doubts, explain topics simply, suggest study plans, quiz the student, and point them to ThunderStudy's tools when relevant (Mock Tests, Study Material at thunderstudy.indevs.in, the daily 5-question quiz).
${periodGuidance}

General rules:
- Stay encouraging — exam prep is stressful, don't add pressure.
- If you don't know something specific about ThunderStudy's platform, say so plainly rather than guessing.
- Never diagnose medical conditions; for anything beyond normal/common symptoms, suggest a doctor or trusted adult.
- No emoji spam — use them sparingly if at all, matching the tone above.`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server is missing GROQ_API_KEY.' });
  }

  try {
    const { messages, profile, settings } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array is required.' });
    }

    const trimmed = messages.slice(-14).map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content || '').slice(0, 4000),
    }));

    const systemPrompt = buildSystemPrompt(profile, settings);

    const out = await groqOpenStream({
      apiKey,
      preferred: settings && settings.model,
      messages: [{ role: 'system', content: systemPrompt }, ...trimmed],
      temperature: 0.7,
      maxTokens: 500,
    });

    res.status(200);
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');
    const send = (obj) => res.write(JSON.stringify(obj) + '\n');
    send({ type: 'meta', model: out.key, label: out.label, fallback: out.fallback });

    // Stop reading from Groq if the visitor closes the tab / hits stop.
    const controller = new AbortController();
    res.on('close', () => controller.abort());

    try {
      const full = await readGroqStream(out.body, (text) => send({ type: 'delta', text }), controller.signal);
      if (!full.trim() && !controller.signal.aborted) {
        send({ type: 'error', error: "I couldn't think of a reply — try again." });
      } else {
        send({ type: 'done' });
      }
    } catch (e) {
      console.error('[chat] stream failed:', e && e.message);
      send({ type: 'error', error: 'The reply was cut off. Please try again.' });
    }
    return res.end();
  } catch (err) {
    if (res.headersSent) return res.end();
    return res.status(err.status || 500).json({ error: err.message || 'Unknown server error.' });
  }
}
