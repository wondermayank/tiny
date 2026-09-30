// api/quiz.js — generates 5 MCQs for the daily quiz widget.
// Requires env var GROQ_API_KEY.
import { groqComplete } from './_groq.js';

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
    const raw = out.reply || '{}';
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return res.status(502).json({ error: 'Model returned invalid JSON.' });
    }

    if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
      return res.status(502).json({ error: 'Model returned no questions.' });
    }

    return res.status(200).json({ questions: parsed.questions.slice(0, 5) });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message || 'Unknown server error.' });
  }
}
