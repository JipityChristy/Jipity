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
  browser, including after the user locks Jipity and signs back in.
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
- A separate signed, HTTP-only daily device ledger survives **Lock Jipity** and
  later sign-ins, so signing out no longer resets this browser's daily spending
  or mode counters. Another browser or cleared cookies remains a separate
  ledger; only an explicitly enforced OpenAI project hard limit protects the
  project across devices.
- Production security activity is copied into privacy-safe Vercel runtime logs
  without prompts, private messages, API keys, family details, or session
  identifiers. Vercel Hobby retains these server-side logs for only one hour.
- User-initiated encrypted backup download and restore preserve approved
  memory, safe research, and signed activity without a database or cloud
  subscription. Backups contain AES-GCM ciphertext only and can be restored
  from another signed-in browser using the same existing Jipity project key.
- Rejected over-budget text, speech, and microphone requests receive signed
  activity receipts without contacting a model.
- Explicitly approved public-source research searches only Wikipedia's public
  reference API and Crossref's published-research metadata API. Both are free,
  require no account or API key, and never call an OpenAI model.
- A two-step review shows the exact screened query and both providers before
  a short-lived, session-bound signed approval permits one search against the
  current signed device counter. Private family details, contact information,
  credentials, identifying records, and pasted URLs are blocked before any
  provider request.
- Free public-source research is limited to 12 approved searches per Melbourne
  day on the same signed device ledger. Each provider is called at most once,
  without unattended retries; exact fresh results are reused from encrypted
  device storage without another external request.
- Results distinguish editable **PUBLIC REFERENCE** material from **PUBLISHED
  INDEX** metadata. Neither a link nor a publication entry independently proves
  a claim, and research never becomes approved memory without a separate review.
- A no-model-cost task safety checker shows available, approval-required, and
  blocked tools. Sending, spending, gambling, unattended loops, and external
  sharing remain disabled; each public-source query and any new AI provider
  require explicit approval.
- No new AI provider, paid subscription, paid search API, background task
  runner, or persistent cloud database is enabled. Public-source research is
  intentionally limited to Wikimedia and Crossref; it is not whole-web search.

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
authenticated session but deliberately preserves its separately signed daily
device spending ledger. The ledger is HTTP-only, Secure, SameSite=Strict,
expires automatically, and resets on the Melbourne calendar day.

Public-research approvals are separately HKDF-signed, expire after two minutes,
match the exact reviewed query and authenticated session, and become invalid
after the signed free-search counter changes. Searches are limited to 12 per
Melbourne day on the same device ledger. Provider requests contain only the
approved non-sensitive search text and a generic application user agent; they
never contain the OpenAI key, access code, browser cookies, family details, or
private conversation history. Parallel browser requests can still race without
a separately approved atomic cloud database.

Private-device memory uses a separate HKDF-derived AES-256-GCM key issued only
to an already authenticated session over a `private, no-store` endpoint. The
OpenAI root key itself never leaves the server, and the browser retains its
imported encryption key only in working memory. Browser storage contains
authenticated ciphertext, not plaintext messages, memory summaries, research,
or activity records. Clearing browser data removes this device-only vault;
encrypted manual backups can transfer it to another signed-in browser, but
there is currently no automatic cross-device sync or durable cloud audit ledger.

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
usage to this application. Both use the same existing $0.50 daily device budget.

Limits apply to the signed device ledger and reset on the Melbourne calendar
day. Locking and signing back in restores the same device's verified totals.
Using another browser or clearing its cookies starts a separate device ledger;
concurrent requests can also race. These safeguards are not an account-wide
hard OpenAI billing limit.

For a provider-enforced cap, open the Jipity OpenAI project, select **Limits**
→ **Edit spend limit**, enter the chosen monthly amount, and explicitly enable
**Enforce a hard limit**. A $15 monthly ceiling approximately matches a $0.50
daily allowance over 30 days. Alerts alone do not stop API traffic, and even a
provider hard limit can slightly overshoot while enforcement propagates. Jipity
cannot inspect or modify this account setting without a separate administrator
credential, so its interface accurately labels the provider cap **Not
verified**. Jipity clearly discloses that its natural voice is AI-generated.

## Next safety-first roadmap
1. Confirm the OpenAI project has **Enforce a hard limit** enabled for a
   user-approved monthly amount; the application cannot verify this setting.
2. If separately approved, provision a genuinely free capped encrypted database
   for automatic cross-device memory, an atomic shared daily budget, and an
   append-only durable audit trail. Until then, use encrypted manual backups.
3. Expand public-source research only if a broader search provider has a
   verified free tier, privacy review, strict caps, and explicit user approval.
4. Confirm that an optional additional AI provider such as Grok has a usable free
   credit, acceptable privacy terms, and a verified zero-cost stop before it is
   connected.
5. Add optional draft-only communication and an approval queue; do not enable
   sending, publishing, spending, or impersonation.
6. Only after those barriers pass tests, add narrow user-approved tasks with
   visible budgets, finite time limits, no unattended retries, and no
   guaranteed-income claims.
