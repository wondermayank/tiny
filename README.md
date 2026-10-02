# ThunderStudy AI Assistant

A full companion app UI for ThunderStudy — sidebar-nav app in the style of your
reference mockups, wired to Groq for chat, tools, and a daily quiz. Everything
personal (profile, chats, saved items, settings) stays in the visitor's
browser via `localStorage` — nothing is sent to a database.

## Structure
- `index.html` — the whole app (chat, history, bookmarks, tools, materials,
  profile, settings) in one file.
- `api/chat.js` — Groq call for chat + the 3 Study Tools. Builds a system
  prompt from the visitor's saved name/gender/tone/length settings and
  **streams** the answer back as newline-delimited JSON.
- `api/quiz.js` — Groq call that returns up to 5 MCQs as JSON for the daily
  quiz widget. Every question is validated (4 distinct options, `answerIndex`
  0–3) before it reaches the browser.
- `vendor/` — self-hosted `model-viewer`, Draco decoder and KaTeX (formulas).

## Features implemented
- **Onboarding** — first visit asks name + gender, stored locally, used to
  personalize tone (see "Gender-aware answers" below).
- **Chat** — bubble UI, quick-action chips (Study Plan / Explain Topic / Ask
  Doubt / Syllabus / Mock Test → opens your existing aimock app.html).
  Replies stream in as they are written and are shown as formatted Markdown
  (bold, lists, tables, code) with LaTeX formulas typeset by KaTeX — KaTeX is
  only downloaded the first time a reply contains a formula. The message box
  grows with the text (up to 4000 characters); Enter sends, Shift+Enter adds a
  new line (on phones Enter adds a new line — use the send button).
- **Daily Quiz** — one Groq-generated quiz per day (local calendar day), kept
  on the device so it can't be re-rolled. Every answer is saved as it is
  given, so closing the quiz half way resumes where you stopped. The result is
  added to Saved automatically, once.
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
  Detailed), dark mode, and a "clear my data" button (keeps your theme).
- **Phones (≤640px)** — the sidebar becomes a bottom tab bar, the character
  becomes a small avatar in the header, the streak shows in the header and the
  progress stats move to the Profile page.
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
The character on the right side is a 3D model (`images/character.glb`, ~0.5 MB — simplified to
about 160k triangles and Draco-compressed), shown with Google's `<model-viewer>`. Everything is
self-hosted (`vendor/model-viewer.min.js`, `vendor/draco/`), so it works without any CDN. The panel
is hidden on screens under 900px wide, and the viewer script itself is only downloaded on wider
screens. To swap the character, replace `images/character.glb`, then re-render the small images
from it: `images/character.webp` (loading preview), `images/avatar.webp` (mobile header) and
`images/og.jpg` (link-preview image).

## AI models
Pick a model from the chip above the chat box, or in Settings. Tiny is the default.

| Name | Groq model |
|---|---|
| **Tiny** (Best, default) | `openai/gpt-oss-120b` |
| Tiny Lite | `openai/gpt-oss-20b` |
| Llama 3.3 70B | `llama-3.3-70b-versatile` |
| Llama 3.1 8B | `llama-3.1-8b-instant` |

The list and fallback logic live in `api/_groq.js`. If the chosen model is unavailable (rate limit,
outage), the others are tried automatically (Tiny first) and the chat says which one answered. If
Groq rejects the API key itself (401/403) the fallback stops straight away, and the real reason is
written to the Vercel function log while visitors see a short, friendly message. The daily quiz and
Study Tools use the same selected model.

## Deploy on Vercel
1. Get a Groq key at console.groq.com → API Keys.
2. Push this folder to GitHub, import into Vercel (no framework preset
   needed — static file + `api/` functions are auto-detected).
3. Project → Settings → Environment Variables → add `GROQ_API_KEY`.
4. Deploy. You can point this at a subdomain like `assistant.thunderstudy.indevs.in`
   or swap it in for the current `aimock.thunderstudy.indevs.in` experience.
5. In `index.html` (top of `<head>`), change the `canonical`, `og:url`, `og:image` and
   `twitter:image` addresses if your final domain is not `assistant.thunderstudy.indevs.in`.

### CLI alternative
```bash
npm i -g vercel
vercel login
vercel
vercel env add GROQ_API_KEY production
vercel --prod
```

## Known limits / next steps
- The once-a-day quiz is enforced in the browser (localStorage) and there is no
  server-side rate limit on `/api/chat` or `/api/quiz` — fine for a
  personal/student tool, not abuse-proof. For a hard cap, add Vercel KV keyed
  by IP or a signed cookie in `api/quiz.js` and `api/chat.js`.
- "Save Mock Test" from the existing `app.html` doesn't yet write into this
  app's Bookmarks — they're separate localStorage stores today since
  `app.html` lives on a different origin/page. If you want them unified,
  either merge this UI into `app.html` directly, or have `app.html` push a
  `postMessage` / write to a shared key once both are on the same domain.
