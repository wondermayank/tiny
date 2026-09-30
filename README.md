# ThunderStudy AI Assistant

A full companion app UI for ThunderStudy — sidebar-nav app in the style of your
reference mockups, wired to Groq for chat, tools, and a daily quiz. Everything
personal (profile, chats, saved items, settings) stays in the visitor's
browser via `localStorage` — nothing is sent to a database.

## Structure
- `index.html` — the whole app (chat, history, bookmarks, tools, materials,
  profile, settings) in one file. Character art on the right is your uploaded
  render (`images/character.png`).
- `api/chat.js` — Groq call for chat + the 3 Study Tools. Builds a system
  prompt from the visitor's saved name/gender/tone/length settings.
- `api/quiz.js` — Groq call that returns 5 fresh MCQs as JSON for the daily
  quiz widget.

## Features implemented
- **Onboarding** — first visit asks name + gender, stored locally, used to
  personalize tone (see "Gender-aware answers" below).
- **Chat** — bubble UI, quick-action chips (Study Plan / Explain Topic / Ask
  Doubt / Syllabus / Mock Test → opens your existing aimock app.html).
- **Daily Quiz** — 5 Groq-generated MCQs, resets every day (all 7 days a
  week, no separate weekly cap). Progress bar + save-to-bookmarks on finish.
- **History** — past chat sessions saved locally, click to reopen.
- **Bookmarks** — saved quiz results (extend this the same way to save full
  mock tests from `app.html` if you wire that page to write to the same
  `tsai_bookmarks` localStorage key).
- **Study Tools** — Summarize Notes / Explain Simply / Doubt Solver, all
  calling `/api/chat` with a canned prompt.
- **Study Material** — links out to thunderstudy.indevs.in, the AI Mock Test
  Maker, and the CBT dashboard.
- **Profile** — edit name/gender any time.
- **Settings** — tone (Friendly/Formal), answer length (Short/Balanced/
  Detailed), dark mode, and a "clear my data" button.
- **Stats bar** — streak, quizzes taken, accuracy, level — all computed
  honestly from local data (no fake numbers).

## Gender-aware answers
Per your spec: if the profile is "girl" and she asks about periods, the
system prompt tells the model to explain what's happening in the body,
common symptoms, self-care do's and don'ts, and when to see a doctor — warm
and factual, not clinical. If the profile is "boy", the model keeps the
biology brief and spends more of the answer on how to be supportive
(practical, respectful, non-awkward). This logic lives in
`buildSystemPrompt()` in `api/chat.js` — edit the wording there any time.

## 3D character
The character on the right side is a 3D model (`images/character.glb`), shown with Google's
`<model-viewer>`. Everything is self-hosted (`vendor/model-viewer.min.js`, `vendor/draco/`), so it
works without any CDN. It auto-rotates and can be dragged. To swap the character, replace
`images/character.glb`. `images/character.png` is only the loading preview. The panel is hidden
on screens under 900px wide, same as before.

## AI models
Pick a model from the chip above the chat box, or in Settings. Tiny is the default.

| Name | Groq model |
|---|---|
| **Tiny** (Best, default) | `openai/gpt-oss-120b` |
| Tiny Lite | `openai/gpt-oss-20b` |
| Llama 3.3 70B | `llama-3.3-70b-versatile` |
| Llama 3.1 8B | `llama-3.1-8b-instant` |

The list and fallback logic live in `api/_groq.js`. If the chosen model is unavailable for your Groq
key, the others are tried automatically (Tiny first) and the chat says which one answered. The
daily quiz and Study Tools use the same selected model.

## Deploy on Vercel
1. Get a Groq key at console.groq.com → API Keys.
2. Push this folder to GitHub, import into Vercel (no framework preset
   needed — static file + `api/` functions are auto-detected).
3. Project → Settings → Environment Variables → add `GROQ_API_KEY`.
4. Deploy. You can point this at a subdomain like `assistant.thunderstudy.indevs.in`
   or swap it in for the current `aimock.thunderstudy.indevs.in` experience.

### CLI alternative
```bash
npm i -g vercel
vercel login
vercel
vercel env add GROQ_API_KEY production
vercel --prod
```

## Known limits / next steps
- Daily quiz and rate limits are client-side (localStorage) — fine for a
  personal/student tool, not abuse-proof. For a hard server-side cap, add
  Vercel KV keyed by IP or a signed cookie in `api/quiz.js` and `api/chat.js`.
- "Save Mock Test" from the existing `app.html` doesn't yet write into this
  app's Bookmarks — they're separate localStorage stores today since
  `app.html` lives on a different origin/page. If you want them unified,
  either merge this UI into `app.html` directly, or have `app.html` push a
  `postMessage` / write to a shared key once both are on the same domain.
- Character image is ~2MB — worth compressing to WebP for faster load,
  same as noted for the Tiny build.
