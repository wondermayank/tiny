// api/quiz.js — generates 5 MCQs for the daily quiz widget.
// Requires env var GROQ_API_KEY.
import { groqComplete } from './_groq.js';


// Models sometimes wrap JSON in fences or add a sentence around it, so be forgiving.
function parseJson(raw) {
  const text = String(raw || '').trim();
  try {
    return JSON.parse(text);
  } catch {
    const i = text.indexOf('{');
    const j = text.lastIndexOf('}');
    if (i >= 0 && j > i) {
      try { return JSON.parse(text.slice(i, j + 1)); } catch { /* fall through */ }
    }
    return null;
  }
}

// Returns a safe question object, or null if the model got the shape wrong.
function cleanQuestion(q) {
  if (!q || typeof q !== 'object') return null;
  const question = typeof q.question === 'string' ? q.question.trim() : '';
  if (!question || !Array.isArray(q.options) || q.options.length !== 4) return null;
  const options = q.options.map((o) => (typeof o === 'string' || typeof o === 'number' ? String(o).trim() : ''));
  if (options.some((o) => !o) || new Set(options).size !== 4) return null;
  const answerIndex = Number(q.answerIndex);
  if (!Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex > 3) return null;
  const explanation = typeof q.explanation === 'string' ? q.explanation.trim().slice(0, 300) : '';
  return { question: question.slice(0, 500), options: options.map((o) => o.slice(0, 200)), answerIndex, explanation };
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
    const { topic } = req.body || {};
    const subject = (topic && String(topic).slice(0, 100)) || 'general competitive exam knowledge (mixed GK, reasoning, current affairs)';

    const prompt = `Create exactly 5 multiple-choice questions for a competitive exam student on: ${subject}.
Return ONLY valid JSON, no markdown fences, no preamble, in this exact shape:
{"questions":[{"question":"...","options":["A text","B text","C text","D text"],"answerIndex":0,"explanation":"one short sentence"}]}
Rules: 4 options per question, answerIndex is 0-based index of the correct option, keep questions exam-realistic and unambiguous, keep explanations under 20 words.`;

    const { model } = req.body || {};
    const out = await groqComplete({
      apiKey,
      preferred: model,
      messages: [
        { role: 'system', content: 'You output only strict JSON matching the requested shape. No commentary, no markdown code fences.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.6,
      maxTokens: 900,
      json: true,
    });
    const parsed = parseJson(out.reply);
    if (!parsed) {
      return res.status(502).json({ error: 'Model returned invalid JSON. Please try again.' });
    }

    const questions = (Array.isArray(parsed.questions) ? parsed.questions : [])
      .map(cleanQuestion)
      .filter(Boolean)
      .slice(0, 5);

    // A quiz with only one or two usable questions isn't worth showing — ask the student to retry.
    if (questions.length < 3) {
      return res.status(502).json({ error: 'The quiz came back incomplete. Please try again.' });
    }

    return res.status(200).json({ questions });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message || 'Unknown server error.' });
  }
}
