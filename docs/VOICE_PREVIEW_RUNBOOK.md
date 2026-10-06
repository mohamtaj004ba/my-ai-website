# CallerCore voice Preview runbook

## What is implemented

- Server-only Vapi adapter using saved GPT-Live speaker/reasoner assistants, function tools and authenticated server credentials. No streaming audio server on Vercel.
- Structured per-workspace timezone/hours/holidays, services, FAQ, pricing guidance, transfer/after-hours/emergency policy, voice, disclosure, prohibited claims and instructions.
- Admin-only isolated internal/demo workspace creation. Configuration requires explicitly designated server-side test number/assistant IDs. Paying/customer workspaces cannot be connected. No number purchase or customer activation endpoint.
- Authenticated provider event ingestion verifies the provider call and its saved resource binding. Tool inputs cannot supply tenant or contact IDs. Private account history/payment data is deliberately unavailable over an unverified phone call.
- Confirmed request capture/amendment, approved information retrieval, after-hours checks, truthful disposition, human transfer attempt with deduplication. Appointments/cancellations are requests for a team, not unsupported calendar mutations.
- Atomic canonical call, dashboard call/index, contact, lead, connected-second usage ledger, retry journal and audit writes. Replay does not duplicate usage. Same contact/open request across calls avoids another matching open lead. Provider IDs remain internal; dashboard transcripts use the existing tuple format.
- Delayed events do not regress ended calls; unavailable transcripts/durations remain pending. Pending calls can be re-read through admin reconciliation, using the same normalized lifecycle. Usage is tracked without overage billing.
- Provider-backed pause/resume with approved fallback and read-back. Stale/configuration-changed/error state cannot claim operational. Saving existing receptionist settings invalidates voice verification; no silent provider sync is implied.
- `/voice-operations.html`: gated responsive internal control surface. Customers do not see Vapi, keys or raw provider controls.

## Smallest external setup needed

Preview currently has an OpenAI key, but no Vapi credentials or provisioned voice test resources are available in this environment. GPT-Live requires Vapi private-beta organization enablement.

1. Enable GPT-Live for the Vapi organization (or confirm existing access).
2. Designate a **new/disposable internal** saved GPT-Live assistant and native Twilio/Vapi SIP phone number. Do not reuse a customer/production number. Supply the following securely as **Preview, feature-branch-scoped** Vercel variables, never in chat or Git:
   - `VAPI_PRIVATE_KEY`
   - `VAPI_INTERNAL_ASSISTANT_ID`, `VAPI_INTERNAL_NUMBER_ID`
   - `CALLERCORE_VOICE_WEBHOOK_SECRET` (random 32+ characters)
   - `VAPI_SERVER_CREDENTIAL_ID`: a Vapi Custom Credential sending that secret as `Authorization: Bearer …`.
   - `CALLERCORE_VOICE_CALLBACK_URL`: stable protected branch Preview URL + `/api/voice-webhook`, with no query token.
3. Arrange narrowly scoped authenticated access for that webhook through Preview deployment protection. Do not disable project protection or put a project-wide automation token in a URL. Existing CI bypass credentials must not be copied to provider configuration. If protection rejects provider traffic, use an explicitly approved dedicated Preview ingress; API bearer authentication remains mandatory.
4. Set `CALLERCORE_VOICE_PREVIEW_ENABLED=true` only after the above. Open `/voice-operations.html` as admin, create an internal workspace, enter business policy and save/verify. This endpoint cannot bind normal/paying workspaces.
5. Place actual PSTN calls. An agent without authorized voice/microphone access cannot claim acoustic acceptance from fixtures. Record the acceptance matrix below; compare saved records against the conversation and provider call.

No provider resources were created, no calls placed, no recording enabled, no production changes made in the code-only phase. Do not mark these external steps or legal review complete.

## Internal real-call acceptance matrix

For every row capture call ID, time, result, latency observations, interruptions/corrections, canonical transcript, contact/lead/follow-up, transfer state, usage and audit evidence. All rows currently **not run**.

| Scenario | Expected proof |
|---|---|
| New service, estimate | Useful intake; consent; one contact/open lead/request |
| Existing caller/status | No invented ETA/private account disclosure; linked message |
| FAQ/general question | Approved answer; resolved disposition; no needless callback |
| Wrong number/spam | Polite close; no lead or staff follow-up |
| Complaint | Useful message; truthful escalation; no promised remedy |
| Appointment/reschedule/cancel | Team request, no invented availability/confirmed booking |
| Billing question | General policy or team message; no private account/card collection |
| Human request | Approved blind transfer; requested is not connected |
| Transfer failure/no answer | Unknown/failure preserved; no fabricated success |
| After hours/holiday | Correct local policy; approved transfer or callback |
| Interruption/correction | Natural response; corrected saved request; no duplicate actions |
| Incomplete caller/hangup | Partial call preserved; no guessed final result |
| Provider/tool failure | Safe explanation, no false completion, recoverable pending state |
| Duplicate/delayed events | One record, no double usage, no final-state regression |

## Demo after internal acceptance

Use the same core with a separate nonpaying demo workspace and `VAPI_DEMO_ASSISTANT_ID`/`VAPI_DEMO_NUMBER_ID`. Demo calls are marked sample, capped at five minutes, cannot transfer or contact actual customers, and cannot affect billing or private client data. Preview public number disclosure now requires isolated configuration, fresh provider read-back and operator-reviewed internal/demo call evidence, disclosure review and number-level abuse controls. Missing evidence keeps it unavailable; no acceptance records were fabricated. A website rate limit cannot stop abuse of a disclosed phone number; provider concurrency/number-level abuse controls must be verified before public exposure.

## Known technical limitations requiring provider evidence

- Exact pause fallback/detachment semantics, provider response schemas and HTTP control host must be verified on the designated number. Read-back disagreement leaves error, never success.
- Blind-transfer completion is not reported as a successful human connection without definitive provider evidence; end of transfer request alone is unverified. GPT-Live warm/no-answer fallback plans are not supported by Vapi.
- Missing artifacts are durable pending work. Admin reconciliation is available; a scheduled worker/retention review is required before scale/customer release.
- Recording remains prohibited because GPT-Live does not collect Vapi recording consent. Transcription/disclosure/retention/legal and healthcare suitability remain owner review, not certified by tests.
- OpenAI account model access, acoustic quality and Vapi private-beta availability cannot be established by environment-key presence or unit tests.

## Release boundaries

Keep PR #5 draft/unmerged. Only `feature/callercore-dashboards` and Preview. Production remains older stable; Stripe acceptance preserved; live checkout/subscriptions, automatic overages, tax collection and customer telephony remain closed.
