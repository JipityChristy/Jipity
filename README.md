# Jipity V2.1

Private OpenAI-powered companion starter for Vercel.

## What V2.1 does
- Private access-code sign-in before either the conversation or chat API is
  available.
- Private text conversation using the OpenAI Responses API.
- GPT-5 nano is the normal, lowest-cost conversation model.
- The optional Spiritual button uses GPT-4o for one spiritual exercise message.
- The optional Deep button uses GPT-5.6 Sol with high reasoning for one message.
- Natural read-aloud voices use GPT-4o mini TTS, with Cedar and Marin listed
  first, additional voice choices, a replay cache, and an optional free device
  voice fallback.
- A tap-to-record microphone uses GPT-4o mini Transcribe and places the result
  in the message box for review before it is sent.
- A server-signed cost governor limits conversation history, response tokens,
  daily requests, daily Spiritual and Deep requests, natural-voice requests,
  microphone requests, and estimated daily spending for each authenticated
  session.
- HTTP-only, Secure, SameSite=Strict session and usage cookies cannot be edited
  by browser JavaScript or forged without the server-side signing key.
- Updated Jipity identity, evidence rules, and privacy protections.
- Hard instructions against impersonation, spending, secrets exposure and external disclosure of family information.
- AES-256-GCM encrypted device-only conversation, approved memory, research
  reuse, and visible activity records; legacy plaintext browser storage is
  migrated and removed after encrypted storage succeeds.
- Explicit Always, Verified, Working, and Review shelves keep approved context
  separate from unverified, disputed, and symbolic material.
- Sensitive credentials, payment details, addresses, identifying dates,
  private records, and children's identifying information are rejected before
  persistent memory or research storage.
- Exact safe research repeats can be answered from encrypted device storage
  without another text-model request. Time-sensitive research expires after
  one hour and other research expires after seven days.
- A non-sensitive prompt-cache key makes eligible repeated OpenAI instruction
  prefixes easier to reuse; cached input tokens appear in signed activity.
- Separately signed activity receipts identify altered or forged records. Since
  storage is device-only, deleting a receipt cannot be detected.
- A no-model-cost task safety checker shows available, approval-required, and
  blocked tools. Sending, spending, gambling, unattended loops, and external
  sharing remain disabled; new providers and public searches require approval.
- No new provider, paid subscription, external search connector, background
  task runner, or persistent cloud database is enabled.

## Deploy
1. Put these files in the `JipityChristy/Jipity` GitHub repository.
2. Import that repository into Vercel.
3. In Vercel Project Settings → Environment Variables, add `OPENAI_API_KEY` with your OpenAI API key. Never put the key into GitHub files.
4. Deploy. Normal chat uses `gpt-5-nano`; Spiritual mode uses `gpt-4o`;
   Deep mode uses `gpt-5.6-sol`.

## Private access

The repository contains only the SHA-256 hash of a randomly generated,
high-entropy access code, never the access code itself. An optional
`JIPITY_ACCESS_CODE_HASH` environment variable can replace that hash without a
source change.

Session and spending-ledger signatures are derived server-side from the existing
`OPENAI_API_KEY` with separate HKDF purposes. The API key is never written to
the repository, sent to the browser, replaced, or exposed in session cookies.
Private sessions expire after 12 hours. The **Lock Jipity** button clears the
authenticated session.

Private-device memory uses a separate HKDF-derived AES-256-GCM key issued only
to an already authenticated session over a `private, no-store` endpoint. The
OpenAI root key itself never leaves the server, and the browser retains its
imported encryption key only in working memory. Browser storage contains
authenticated ciphertext, not plaintext messages, memory summaries, research,
or activity records. Clearing browser data removes this device-only vault;
there is currently no cross-device backup or durable cloud audit ledger.

Only relevant, explicitly approved, non-sensitive memories are included in a
chat request. Review material is never injected as established fact. A source
link means that a source is attached; it does not independently prove a claim.

## Model routes and safeguards

| Mode | Model | Per-million input/output price | Daily mode limit |
| --- | --- | --- | --- |
| Normal | `gpt-5-nano` | $0.05 / $0.40 | Included in 30 total requests |
| Spiritual | `gpt-4o` | $2.50 / $10.00 | 6 |
| Deep | `gpt-5.6-sol` | $5.00 / $30.00 | 3 |

Prices are standard OpenAI API text-token rates checked on 22 August 2026.
Normal mode uses minimal reasoning; Deep uses high reasoning. GPT-4o does not
receive a reasoning-effort parameter.

The daily budget is stored in a tamper-evident, server-signed HTTP-only usage
cookie, and the chat, speech, and transcription endpoints verify it before
each model request. Natural voice is limited to 18 requests per day; recordings
are limited to 20 requests, 60 seconds, and 2 MB each. Previously generated
audio can be replayed from the current browser without a new model request.
Transcription reserves $0.003 per request; speech reserves a conservative
character-based estimate because binary audio responses do not report token
usage to this application. Both use the same existing $0.50 session budget.

Limits apply per authenticated session and reset on the Melbourne calendar
day. A new authorized sign-in starts a new session; concurrent requests can
also race. These safeguards are not an account-wide hard OpenAI billing limit.
Configure a separate OpenAI Platform project budget for account-level spend
protection. Jipity clearly discloses that its natural voice is AI-generated.

## Next safety-first roadmap
1. Confirm that an optional additional provider such as Grok has a usable free
   credit, acceptable privacy terms, and a verified zero-cost stop before any
   provider is connected.
2. If separately approved, provision a genuinely free capped encrypted database
   for cross-device memory and an append-only durable audit trail.
3. Add a privacy-screened public-web research tool with explicit per-search
   approval, source labels, freshness limits, and result deduplication.
4. Add optional draft-only communication and an approval queue; do not enable
   sending, publishing, spending, or impersonation.
5. Only after those barriers pass tests, add narrow user-approved tasks with
   visible budgets, finite time limits, no unattended retries, and no
   guaranteed-income claims.
