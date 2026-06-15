# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Next.js 14 demo of a real-time compliance copilot for energy customer-service calls. A scripted Victorian electricity call streams in line by line; on each line the copilot re-evaluates the conversation against Victorian hardship policy and emits an ALLOW / BLOCK / ESCALATE / INSUFFICIENT_INFORMATION decision plus risks, obligations, completed/missing checklist steps, and suggested agent wording. It is a presentation demo — reliability on stage is a primary design goal.

## Commands

```bash
npm run dev      # local dev server at http://localhost:3000
npm run build    # production build
npm run lint     # next lint
npm test         # all tests (node --test via tsx)
```

Run a single test file: `node --import tsx --test tests/mockCopilot.test.ts`.
There is no `.env.example` checked in despite the README referencing it; configure env vars directly (see below).

## Environment variables

| Variable | Effect |
| --- | --- |
| `OPENAI_API_KEY` | Server-side only. Absent → mock engine is used. |
| `OPENAI_MODEL` | Model for live analysis (default `gpt-5.5`). |
| `USE_MOCK_COPILOT=true` | Forces the deterministic mock engine, no API calls. |
| `NEXT_PUBLIC_DEMO_REFRESH_SECONDS` | Auto-play interval (default `4`). The only client-visible var. |

## Architecture

The request flow on every transcript line:

```
app/page.tsx  (client, "use client")
   → POST /api/copilot  with { transcript_so_far, previous_copilot_state }
       → app/api/copilot/route.ts  (server, runtime="nodejs")
           → lib/openaiCopilot.ts   (live: OpenAI Responses API, strict JSON schema)
           → lib/mockCopilot.ts     (deterministic fallback)
   ← CopilotApiResponse { state, source: "openai"|"mock", fallback_note? }
```

Key invariants to preserve when editing:

- **Two interchangeable engines, one output shape.** Both `analyzeCallState` (live) and `mockAnalyzeCallState` return the same `CopilotState` (`lib/types.ts`). Any field added to the state must be produced by *both* engines and reflected in `lib/schema.ts` (the strict OpenAI `json_schema`) and `lib/prompt.ts`.
- **Triple fallback to mock**, decided in `route.ts`: (1) `USE_MOCK_COPILOT=true`, (2) no `OPENAI_API_KEY`, (3) any live-call exception is caught and degrades to mock with a `fallback_note`. The demo must never throw to the user. `openaiCopilot.ts` throws readable `Error`s precisely so `route.ts` can catch and fall back.
- **The OpenAI call is server-only.** The API key lives only in `route.ts` / `openaiCopilot.ts`; never import these into a `"use client"` component or surface the key to the browser.
- **Decision priority order is the contract.** Both engines apply: life support → hard BLOCK; family violence → ESCALATE (safe wording); job loss / inability to pay → ESCALATE (collections/disconnection not allowed) + URGS screening; complaint/dispute → BLOCK; incomplete mandatory checks → BLOCK; otherwise ALLOW. This ordering is encoded in `mockCopilot.ts` and described in `prompt.ts`; keep the two in sync.

### Data layer (`data/` + `lib/demoData.ts`)

All demo content is file-driven and bundled at build time, *not* read from the filesystem at runtime (so it works on Vercel):

- `data/customer_case.json` → typed as `CustomerCase`.
- `data/compliance_policy.md`, `data/victoria_hardship_reference.md`, `data/transcript_script.txt` → imported as **raw strings** via the `asset/source` webpack rule in `next.config.mjs` (declared by `raw-files.d.ts`). Editing these `.md`/`.txt` files changes the demo with no code change.
- `transcript_script.txt` is pipe-delimited `timestamp|speaker|text`, one line per turn. `lib/parseTranscript.ts` splits on only the first two pipes (text may contain pipes) and throws on malformed lines.

The mock engine pattern-matches against literal phrases from `transcript_script.txt` (e.g. `/lost my job/i`, `/sarah mitchell,?\s*14 may 1987/i`). **If you edit the transcript wording, the corresponding regexes in `lib/mockCopilot.ts` must be updated too**, or the mock decision logic silently breaks.

### Other lib modules

- `lib/caseNote.ts` — `formatFinalCaseNote`, the CRM/audit-note string built client-side from the final `CopilotState`.
- `lib/types.ts` — single source of truth for all shared types.

## Tests

`tests/` covers the parser, the mock engine against the demo's acceptance criteria (no ALLOW before mandatory checks complete, ESCALATE on hardship disclosure, paused collections + referral recorded), and the case-note format. When changing decision logic or transcript content, update `tests/mockCopilot.test.ts` and `tests/parseTranscript.test.ts` accordingly.

## Branding

All brand colours are `--supa-*` CSS variables at the top of `app/globals.css`. Change them there only.

## Note

All customer data is fictional; the copilot is an advisory control referencing Victorian hardship obligations (ESC Energy Retail Code of Practice v5, Water Industry Standard v4, DFFH Utility Relief Grant Scheme), not legal advice.
