# Real-Time Compliance Call Copilot

> A live agent-assist layer that monitors customer conversations, flags compliance risks, suggests the next best compliant action, and generates an audit-ready case note.

The app simulates a live customer service call from a SUPA Energy agent to a residential Victorian electricity customer. The transcript streams in line by line; on every new line the copilot re-checks the conversation against the Victorian hardship policy, updates its decision (ALLOW / BLOCK / ESCALATE / INSUFFICIENT INFORMATION), surfaces the applicable obligations, and guides the agent's next compliant action. The key moment: when the customer discloses job loss, the copilot immediately flags financial hardship and possible Utility Relief Grant Scheme eligibility, blocks the proposed collections/disconnection pre-check, and routes the agent to the hardship support process.

## Victorian compliance context

The copilot's reference material is built from official Victorian sources, encoded as advisory controls (not legal advice):

- Essential Services Commission, Energy Retail Code of Practice, version 5, effective 1 February 2026 — payment difficulty framework: standard and tailored assistance, missed-payment timing for arrears above AUD 55, no debt recovery or debt sale during assistance, disconnection as a last resort, family violence safe support, and life support protections.
- Essential Services Commission, Water Industry Standard — Urban Customer Service, version 4, effective 1 July 2024 — included in the reference file to show the pattern generalises across utilities (restriction last resort, hard-stop conditions, life support).
- Victorian Department of Families, Fairness and Housing, Utility Relief Grant Scheme (URGS) — eligibility indicators, grant limits, and the account-hold rule while an application is considered.

The full reference lives in `data/victoria_hardship_reference.md` and is passed to the model on every analysis alongside `data/compliance_policy.md`. Decision priority: life support → hard BLOCK; family violence → ESCALATE with safe wording; job loss / inability to pay → ESCALATE (collections/disconnection not allowed) with URGS screening; complaint or dispute → BLOCK enforcement; incomplete mandatory checks → BLOCK; otherwise ALLOW.

Built with Next.js 14 so it deploys directly to Vercel. The OpenAI call runs only in a server-side API route — the API key is never exposed to the browser.

## Setup (local)

```bash
npm install
cp .env.example .env
# Add your OPENAI_API_KEY to .env (or leave it out — see Fallback mode)
npm run dev
```

Open http://localhost:3000.

## Demo steps

1. Click **Start live demo** (auto-plays a line every 4 seconds) or use **Advance one line** for full manual control during the presentation.
2. Watch the live transcript populate and the copilot's checklist and decision update on every line.
3. At line 8 the customer discloses job loss — the decision flips to **ESCALATE**, high-severity financial hardship and URGS-eligibility flags appear, the relevant Energy Retail Code of Practice obligations are listed, and suggested agent wording is offered.
4. Advance to show the agent following the guidance: the hardship question is recorded as a completed step, collections is paused, payment assistance and Utility Relief Grant options are raised, and the case is referred to the support team.
5. Click **Generate final case note** for a CRM-ready, audit-evidenced summary, then **Copy to clipboard**.
6. **Reset** returns to the initial state so the demo can be replayed without touching code.

Presenter tip: rely on **Advance one line** in the meeting — it can't be caught out by timing, and each click maps to a beat in your talk track.

## Environment variables

| Variable | Purpose | Default |
| --- | --- | --- |
| `OPENAI_API_KEY` | Server-side only; never sent to the browser. | — |
| `OPENAI_MODEL` | Model used for copilot analysis. | `gpt-5.5` |
| `USE_MOCK_COPILOT` | `true` forces the deterministic simulated copilot (no API calls). | `false` |
| `NEXT_PUBLIC_DEMO_REFRESH_SECONDS` | Seconds between lines during auto-play. | `4` |

## Fallback mode

The demo can never fail on stage. The deterministic simulated copilot takes over in any of these cases, and the header shows a "Simulated copilot" pill so you always know which engine answered:

- `USE_MOCK_COPILOT=true` is set,
- no `OPENAI_API_KEY` is configured, or
- a live API call fails mid-demo (network, quota, latency) — the app automatically falls back for that update and shows a dismissible note.

The simulated copilot follows the same Victorian policy logic: life support → hard **BLOCK**; family violence → **ESCALATE** with safe wording; hardship or inability-to-pay signals → **ESCALATE** with URGS screening; complaint/dispute → **BLOCK**; incomplete mandatory checks → **BLOCK**; all checks complete with no risk signals → **ALLOW**.

## Deploy to Vercel

1. Push this folder to a GitHub repository.
2. In Vercel: **Add New Project → Import** the repo. The Next.js defaults are correct — no configuration needed.
3. Under **Settings → Environment Variables**, add `OPENAI_API_KEY` (and optionally `OPENAI_MODEL`, `USE_MOCK_COPILOT`, `NEXT_PUBLIC_DEMO_REFRESH_SECONDS`).
4. Deploy. For a zero-risk presentation you can deploy with `USE_MOCK_COPILOT=true` and flip it off later.

## Tests

```bash
npm test
```

Covers the transcript parser, the simulated copilot against the demo's acceptance criteria (no ALLOW before checks complete, ESCALATE on hardship disclosure, paused collections and referral recorded), and the CRM case note format.

## Project structure

```text
app/
  api/copilot/route.ts   # Server-side analysis endpoint (OpenAI + mock fallback)
  layout.tsx             # Fonts and metadata
  page.tsx               # Demo UI: transcript, controls, copilot panel
  globals.css            # SUPA Energy brand tokens and all styling
components/
  TranscriptFeed.tsx
  CopilotPanel.tsx
lib/
  prompt.ts              # Copilot system prompt
  schema.ts              # Strict JSON response schema
  openaiCopilot.ts       # OpenAI Responses API wrapper (server-side only)
  mockCopilot.ts         # Deterministic fallback engine
  parseTranscript.ts     # Pipe-delimited transcript parser
  caseNote.ts            # CRM case note formatter
  demoData.ts            # Loads the data/ files
data/
  customer_case.json              # Fictional Victorian residential electricity customer
  compliance_policy.md            # Victorian energy hardship handling checklist
  victoria_hardship_reference.md  # ESC Energy Retail Code of Practice, Water Industry Standard, URGS reference
  transcript_script.txt           # Scripted call (timestamp|speaker|text)
tests/
```

## Branding

All brand colours are CSS variables at the top of `app/globals.css`, following SUPA Energy's visual language. To match official brand hex values exactly, edit the `--supa-*` tokens in that one block.

---

Demo environment — all customer data is fictional. The copilot is an advisory control referencing Victorian hardship obligations; it is not legal advice. The human agent remains responsible for final action.
