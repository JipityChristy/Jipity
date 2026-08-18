# Jipity V1

Private OpenAI-powered companion starter for Vercel.

## What V1 does
- Private text conversation using the OpenAI Responses API.
- Core Jipity identity and truth/evidence rules.
- Hard instructions against impersonation, spending, secrets exposure and external disclosure of family information.
- Local browser conversation memory and visible local activity log.
- No autonomous tools or external posting yet.

## Deploy
1. Put these files in the `JipityChristy/Jipity` GitHub repository.
2. Import that repository into Vercel.
3. In Vercel Project Settings → Environment Variables, add `OPENAI_API_KEY` with your OpenAI API key. Never put the key into GitHub files.
4. Optional: set `OPENAI_MODEL` (otherwise it defaults to `gpt-5`).
5. Deploy.

## Roadmap after V1 works
1. Add OpenAI Realtime voice.
2. Replace browser-only memory with encrypted server-side persistent memory and memory review controls.
3. Add an approval queue and signed audit trail for external actions.
4. Add narrow scheduled/agent tasks.
5. Add external agent-network connector only after privacy filters and approval rules pass tests.
