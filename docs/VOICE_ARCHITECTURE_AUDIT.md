# Voice audit — 2026-10-06

Audited before implementation at `99c313adcfeb6d850dce8769d1764f179e6f5efc`.

## Existing system

- `api/account.js`: authenticated workspace receptionist settings, revision guards, atomic configuration/audit writes, admin phone inventory. No provider requests. `aiAnsweringControl` deliberately returns 409. Launch checks correctly require actual voice evidence.
- `lib/voice-status.js`: saved inventory never establishes operational voice. Preserve this fail-closed boundary.
- `lib/preview-seed.js`, other Preview seed modules: sample calls, transcripts, numbers, usage and leads. These are fixtures, not voice acceptance evidence.
- `calls:<workspace>`, `calls:index:<workspace>`, `leads:<workspace>`, follow-up state and workspace usage power existing dashboards. Contacts are currently derived from calls/leads; there is no independent provider-backed contact lifecycle.
- `agent:<workspace>` contains greeting, tone, textual hours/service area, transfer destination, emergency/handling instructions and qualification questions. Textual hours cannot safely establish current business-hours transfer eligibility.
- `lib/business-hours.js` is a support-business-hours helper; do not reuse its fixed weekday/default timezone assumptions for client voice routing.
- `api/demo-number.js` has protected number disclosure and a legacy default number. Disclosure is not provider readiness. No incoming voice webhook, Vapi adapter, call tool endpoint, recording policy or call usage writer exists.
- Stripe sandbox acceptance is complete and independent. Do not rerun or alter billing launch gates.

## Current external evidence

Read-only Vercel environment inventory: Preview has `OPENAI_API_KEY` and isolated Preview storage. No `VAPI_API_KEY`, `VAPI_PRIVATE_KEY`, voice webhook secret, or internal test number configuration. No local environment file or Vapi connector was found. Secrets were not read or printed.

## Provider architecture decision

PSTN → saved Vapi GPT-Live assistant (speaker + reasoner) → authenticated CallerCore function tools/webhooks → canonical workspace call/CRM/usage state. Vapi owns streaming audio; CallerCore HTTP functions handle bounded tools and durable events. No long-running audio socket in a request handler.

CallerCore owns configuration revisions, resource association, call identity, tool authorization, CRM results, usage and audit. Vapi IDs are internal bindings. Never infer workspace from caller input, tool arguments, metadata supplied by a caller, or a guessed number.

Official sources checked:
- https://developers.openai.com/api/docs/guides/live
- https://developers.openai.com/api/docs/guides/live-partner-integrations
- https://docs.vapi.ai/gpt-live/overview
- https://docs.vapi.ai/gpt-live/quickstart
- https://docs.vapi.ai/gpt-live/tools
- https://docs.vapi.ai/server-url/server-authentication

GPT-Live is a real full-duplex model, not the Realtime model with another name. Vapi requires private-beta enablement. It uses separate speaker/reasoner prompts and supports blind transfers on Twilio/Vapi SIP; warm transfers and native Telnyx/Vonage are not supported. Do not silently substitute another model or promise exact generated disclosure wording. Use saved-resource Custom Credentials for authenticated tools/webhooks.

## Release boundaries

Feature branch and isolated Preview only. Production remains the older stable release. Customer telephony, public demo availability, checkout, overage billing and legal/recording approval remain closed until independently verified/authorized. Internal technical fixtures cannot prove real-call latency, interruption handling or transcript quality.
