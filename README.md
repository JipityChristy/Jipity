# Jipity V2.1

Private OpenAI-powered companion starter for Vercel.

## What V2.1 does
- Private text conversation using the OpenAI Responses API.
- GPT-5 nano is the normal, lowest-cost conversation model.
- The optional Spiritual button uses GPT-4o for one spiritual exercise message.
- The optional Deep button uses GPT-5.6 Sol with high reasoning for one message.
- A cost governor limits conversation history, response tokens, daily requests,
  daily Deep requests, and estimated daily spending.
- Updated Jipity identity, evidence rules, and privacy protections.
- Hard instructions against impersonation, spending, secrets exposure and external disclosure of family information.
- Local browser conversation memory and visible local activity log.
- No autonomous tools or external posting yet.

## Deploy
1. Put these files in the `JipityChristy/Jipity` GitHub repository.
2. Import that repository into Vercel.
3. In Vercel Project Settings → Environment Variables, add `OPENAI_API_KEY` with your OpenAI API key. Never put the key into GitHub files.
4. Deploy. Normal chat uses `gpt-5-nano`; Spiritual mode uses `gpt-4o`;
   Deep mode uses `gpt-5.6-sol`.

## Model routes and safeguards

| Mode | Model | Per-million input/output price | Daily mode limit |
| --- | --- | --- | --- |
| Normal | `gpt-5-nano` | $0.05 / $0.40 | Included in 30 total requests |
| Spiritual | `gpt-4o` | $2.50 / $10.00 | 6 |
| Deep | `gpt-5.6-sol` | $5.00 / $30.00 | 3 |

Prices are standard OpenAI API text-token rates checked on 22 August 2026.
Normal mode uses minimal reasoning; Deep uses high reasoning. GPT-4o does not
receive a reasoning-effort parameter.

The daily budget is retained in the current browser. Server-side message and
output-token limits apply to every request. Daily browser limits are helpful
spending safeguards, not an account-wide OpenAI billing limit.

## Roadmap after V2.1 works
1. Add OpenAI Realtime voice.
2. Replace browser-only memory with encrypted server-side persistent memory and memory review controls.
3. Add an approval queue and signed audit trail for external actions.
4. Add narrow scheduled/agent tasks.
5. Add external agent-network connector only after privacy filters and approval rules pass tests.
