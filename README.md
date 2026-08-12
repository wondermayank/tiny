# Tiny — The 21st Century AI

Wondermayank's Groq-powered chat persona. Static frontend + one Vercel serverless
function that calls Groq's Llama 3.3 70B model, kept behind the API so your key
never reaches the browser.

## How it works
- `index.html` — chat UI. Character art swaps between `images/side.png`
  (idle / thinking) and `images/front.png` (has just answered).
- `api/chat.js` — serverless function. Receives the conversation, adds Tiny's
  system prompt (bio + personality), calls Groq, returns the reply.
- Rate limit: 10 messages per browser per day, tracked in `localStorage`
  (resets at midnight, matches the existing Telegram "Tiny 2.0" bot's limit).
  This is a client-side soft limit — fine for a personal/portfolio project,
  not abuse-proof. See "Harden the rate limit" below if you want a real one.

## Deploy on Vercel

1. **Get a Groq API key** — console.groq.com → API Keys → create one.
2. **Push this folder to a GitHub repo** (or drag-and-drop deploy via the
   Vercel dashboard).
3. **Import the repo in Vercel** — vercel.com/new → select the repo.
   No framework preset needed; Vercel auto-detects the static file +
   `api/` function.
4. **Add the environment variable**:
   - Project → Settings → Environment Variables
   - Key: `GROQ_API_KEY`
   - Value: your Groq key
   - Apply to Production, Preview, and Development
5. **Deploy.** Vercel serves `index.html` and `images/` statically and
   turns `api/chat.js` into `/api/chat`.

### CLI alternative
```bash
npm i -g vercel
vercel login
vercel          # first deploy, follow prompts
vercel env add GROQ_API_KEY production
vercel --prod
```

## Customize
- **Bio / persona**: edit `SYSTEM_PROMPT` in `api/chat.js`.
- **Colors**: CSS variables at the top of `index.html` (`--primary`, etc.) —
  currently Thunder's indigo `#573AFC` (dark mode: `#9A7AFB`).
- **Model**: change `model: 'llama-3.3-70b-versatile'` in `api/chat.js` to
  any Groq-hosted model (e.g. a smaller one for even faster replies).

## Harden the rate limit (optional)
The current limit lives in the visitor's browser, so clearing storage or
using another browser resets it. For a real per-visitor limit, add Vercel
KV (or any small key-value store) in `api/chat.js`, key it off a hashed IP
or a signed cookie, and reject requests server-side once the daily count is
hit — the same pattern the "Tiny 2.0" Telegram bot uses with Cloudflare KV.
