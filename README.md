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
- `vendor/` — self-hosted KaTeX (formulas).
- `images/stickers/` — the sticker poses (`tiny-smile`, `-wave`, `-hello`, `-idea`, `-explain`, `-cheer`, `-sleep`, `-excited`, `-cry`, `-type`) plus five quiz result poses (cut-out art, one per score band: 0-30 stressed, 30-50 sad, 50-70 unsure, 70-90 happy, 90-100 celebrating) (`tiny-score-0-30`, `-30-50`, `-50-70`, `-70-90`, `-90-100`).

## Features implemented
- **Onboarding** — first visit asks name + gender, stored locally, used to
  personalize tone (see "Gender-aware answers" below).
- **Chat** — bubble UI with a bot avatar. The shortcuts live in the sidebar: Study Plan and Syllabus drop a starter sentence into the chat bar, Mock Test opens your aimock app.html, Daily 5-Question Quiz opens the quiz.
  Replies stream in as they are written and are shown as formatted Markdown
  (bold, lists, tables, code) with LaTeX formulas typeset by KaTeX — KaTeX is
  only downloaded the first time a reply contains a formula. The message box
  grows with the text (up to 4000 characters); Enter sends, Shift+Enter adds a
  new line (on phones Enter adds a new line — use the send button).
- **Daily Quiz** — one Groq-generated quiz per day (local calendar day), kept
  on the device so it can't be re-rolled. Every answer is saved as it is
  given, so closing the quiz half way resumes where you stopped. The result is
  added to Saved automatically, once.
- **New chat** — the "New chat" button at the top of the sidebar starts a fresh conversation. The old one stays in History. If a reply is still streaming, it is stopped and kept first.
- **Stop** — while a reply streams, the send button turns into a Stop button. What had already arrived is kept (with a "Stopped" note) and saved to History.
- **Copy and Save** — every reply has a Copy button (copies the reply's text, formulas as LaTeX) and a Save button. Saved answers go to the Saved tab (tap one to read it, copy it or remove it). Stored in `tsai_bookmarks` with `type: 'answer'`; up to 100 are kept, oldest dropped first. Replies reopened from History get the buttons too.
- **History** — past chat sessions saved locally, click to reopen.
- **Bookmarks** — saved chat answers and saved quiz results (extend this the same way to save full
  mock tests from `app.html` if you wire that page to write to the same
  `tsai_bookmarks` localStorage key).
- **Study Tools** — Summarize Notes / Explain Simply / Doubt Solver, all
  calling `/api/chat` with a canned prompt.
- **Study Material** — links out to thunderstudy.indevs.in, the AI Mock Test
  Maker, and the CBT dashboard.
- **Profile** — edit name/gender any time.
- **Settings** — tone (Friendly/Formal), answer length (Short/Balanced/
  Detailed), dark mode, and a "clear my data" button (keeps your theme).
- **Phones (≤900px)** — the sidebar becomes a slide-in menu (hamburger button in the header). The chat bar, sticker and Model chip stay at the bottom, same as on desktop.
- **Progress** — streak, quizzes taken, accuracy, level — shown on the Profile page, computed honestly from local data (no fake numbers). The quiz item in the sidebar shows today's progress.
- **Chat bar** — the paperclip attaches a plain-text file (txt, md, csv, code; up to 400 KB, trimmed to the 4000-character limit). The mic uses the browser's speech recognition (Chrome/Edge/Safari; other browsers show a short message).

## Gender-aware answers
Per your spec: if the profile is "girl" and she asks about periods, the
system prompt tells the model to explain what's happening in the body,
common symptoms, self-care do's and don'ts, and when to see a doctor — warm
and factual, not clinical. If the profile is "boy", the model keeps the
biology brief and spends more of the answer on how to be supportive
(practical, respectful, non-awkward). This logic lives in
`buildSystemPrompt()` in `api/chat.js` — edit the wording there any time.

## Sticker
The sticker sits above the chat bar, left of the Model chip. It shows a different pose for each moment:
smile (idle), type (laptop: you are typing, or Tiny is reading your attached file), idea (hover / tap), explain (the AI is answering),
sleep (late night), excited (something good happened), cry (offline, or a sad moment), and wave / hello / cheer as answer reactions.

- **Quiz reactions** — after every answer in the daily quiz, a right answer shows the excited pose and a wrong one the crying pose (in the quiz window next to "Correct!" / "Not quite", and on the main sticker behind it).
- **Quiz result stickers** — the result screen shows a pose for the percentage of questions right: 0 to 29% `score-0-30` (stressed, failed paper), 30 to 49% `score-30-50` (sad), 50 to 69% `score-50-70` (unsure), 70 to 89% `score-70-90` (smiling), 90 to 100% `score-90-100` (the "100" paper). With 5 questions that is 0-1 right, 2, 3, 4, 5. The main sticker shows the same pose for about five seconds after the quiz window is closed. The bands and messages are `SCORE_BANDS` in `index.html`.
- **Typing and files** — while the chat box has text in it the sticker works on her laptop. Attaching a text file shows the same pose while it is read, and again while Tiny answers a message built from that file (instead of the usual "explain" pose). This pose is shown taller than the others (`.sticker[data-pose="type"]` in the CSS) so the laptop and hands clear the chat bar.
- **Answer reactions** — after each answer the sticker picks a pose from what was said (`answerPose()` in `index.html`, first match wins): painful → cry, a greeting → wave, praise or "that's right" → excited, rest and sleep advice → sleep, thanks → cheer, two or more tip words → idea, long or structured (lists, tables, code, formulas, over 900 characters) → explain, very short → smile, anything else → hello. Add your own rules there.

- **Sleep** — if the app is opened between 8 PM and 5 AM (the visitor's local time) the sticker starts asleep, and there is no wave greeting. Typing or hovering wakes her for a moment; sending the first message wakes her for good (until the page is reopened). Change the hours with `NIGHT_FROM` / `NIGHT_TO` in `index.html`.
- **Cry** — shown while the browser is offline (it stays until the connection is back, with a toast when it returns), and for about five seconds when a chat or Study Tool answer fails, or when an answer is about something painful. An answer counts as painful if it has one strong word (tragedy, grief, suicide, abuse, "sorry to hear"...) or three different softer ones (death, war, loss, suffer...). Both word lists are `PAIN_STRONG` / `PAIN_SOFT` in `index.html`; edit them to taste. Painful answers show the crying pose instead of the usual cheer.
- **Excited** — shown for about five seconds when something good happens: a daily-quiz score of 4/5 or better, a level-up, or a study-streak milestone (3, 7, 14, 21, 30, 50, 100 days; list is `STREAK_MILESTONES`). For the quiz it plays when the quiz window is closed. Call `goodNews()` from anywhere in the script to trigger it for a new event.

- **Hover** (tap on phones) shows a "Did you know?" bubble with a short fact.
- **Click** (or the "Explain it fully" button) asks that topic in the chat, e.g. "What is the periodic table?", and the full
  answer streams into the chat. The topic list is `TOPICS` in `index.html`; add your own `{ fact, q }` pairs there.
- These questions are sent with `detail: true`, so `api/chat.js` allows a longer, fully structured answer (1400 tokens instead of 500).
- Poses are in `images/stickers/` (480×560 transparent WebP). To change one, replace the file with the same name. Only the top part of the picture shows above the chat bar, so keep the head near the top.

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
