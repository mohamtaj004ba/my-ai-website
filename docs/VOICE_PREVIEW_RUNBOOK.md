# CallerCore voice Preview runbook

Use [the latest continuation checkpoint](#voice-continuation-checkpoint--2026-10-06-owner-feedback-and-recovery) for current resources, verified builds, budget and remaining gates. Earlier dated sections are historical evidence; they are not current voice acceptance.

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

## Current isolated setup and remaining acceptance

Updated 2026-10-06: Vapi browser access is available. The isolated internal GPT-Live assistant and (509) 408-9058 are assigned and verified through CallerCore provider read-back. A restricted private key permits only that assistant, with transient assistants disabled. The key and dedicated Bearer webhook secret are saved only in feature-branch Preview. Administrator sign-in works. Actual inbound PSTN calls have reached authenticated tools and canonical call/contact/follow-up/usage records. The previous public demo assistant/number and LeadConnector callback were not edited.

TJ explicitly approved public access to the stable feature-branch Preview alias for provider callbacks. That alias alone has a deployment-protection override; CallerCore session authorization and webhook Bearer checks remain mandatory. Other deployments and Production were not changed. Resource read-back and actual webhook delivery are verified; full real-call and acoustic acceptance remain incomplete.

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

The numbered steps above describe the setup procedure for another isolated environment, rather than outstanding setup on this branch. Recording remains off. The controlled test caller uses fictional details and a three-minute cap within TJ's approved $5 budget. Do not mark full external acceptance or legal review complete. Do not assume organization credential fallback is isolated solely because a credential is explicitly selected on the internal number.

## Internal real-call acceptance matrix

For every row capture call ID, time, result, latency observations, interruptions/corrections, canonical transcript, contact/lead/follow-up, transfer state, usage and audit evidence. First actual call ran on 2026-10-06 (195 seconds): regular-hours answer verified, estimate save failed because the tool received a local ten-digit callback number. Subsequent actual calls verified corrected estimate capture, direct routine answers, canonical CRM/usage updates and explicit endCall termination. This establishes those scenarios only; the rest of the matrix remains open.

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


## First-call latency investigation — 2026-10-06
Observed ten reasoner rounds lasted approximately 1.98–3.95 seconds; routine-hours lookup added an avoidable handoff. The speaker now contains approved static business knowledge. Dynamic current-open/holiday/transfer decisions remain server verified. Vapi's classic Latency Summary reported no data for this GPT-Live call, so no turn-latency score was invented. Early audio trace samples showed arrival gaps approximately 100–296ms and queue peaks up to 160ms, but this limited sample does not establish the cause of TJ's audible buffering. Recording remained disabled, and transcript fragments alone do not prove acoustic quality. Further real-call observation required.
Official technical guidance: https://docs.vapi.ai/gpt-live/testing and https://docs.vapi.ai/gpt-live/configuration. Separate time-to-useful-speech from time-to-confirmed-action; do not tune classic transcriber/TTS controls for GPT-Live, which generates speech directly.

### Controlled estimate regression
Actual inbound call 01a112a1-9a16-7bbd-ba60-9025de5257cc captured a corrected bathroom-sink estimate request and completed the canonical disposition. The direct hours answer needed no lookup. The caller interrupted the opening, so full disclosure delivery was not established in this run. The call ended on silence after goodbye; explicit complete_call ending guidance has been added and still requires a telephone retry. Canonical usage: 151 connected seconds for this call, 6.57 total minutes across three inbound calls. Provider cost of both controlled legs: $0.51. Recording stayed off; smooth speech still needs human listening.

Intake questions and unsaved caller corrections now remain in the speaker conversation. The reasoner is used for confirmed saving/amendments, actual transfers, current policy decisions and final disposition. This removes avoidable backend waits without treating information capture as a completed CRM action.


## Latest acceptance checkpoint (2026-10-06)

- Verified feature commit f822e46d5cc84af3ddf1ab214ef8bfe1b5501acf, immutable Preview https://my-ai-website-f67hy91s6-mohamtaj004bas-projects.vercel.app, CI 37520865894 and CodeQL 37520866010 success. Authenticated Browser QA 37520860702 success (job 112466248373), including visual comparison.
- Actual v8 controlled estimate call ending f50e6: 115 seconds, $0.20, request save/completion/endCall successful; local callback formatted without asking the caller for technical formatting; appointment request distinguished from confirmed booking.
- Actual v8 owner call ending 3edf9: 116 seconds, $0.20; full opening disclosure delivered, leaking-faucet request captured, direct office hours, complete_call/endCall successful. Owner reports background static mostly gone and remaining noise minor. Name transcript is PJ; owner clarified TJ and then allowed that the name may have been unclear. No history was rewritten to pretend otherwise.
- Separate interruption test still skipped disclosure; first-message ordering now moves disclosure before business greeting, and acoustic/interrupt delivery remains a separate acceptance condition.
- No callback timeframe has been approved for the fictional office. Blank timing preferences should not be read out in confirmations.
- Current non-blocked fixes: preserve holiday/duration settings through UI saves, disable controls after uncertain provider checks, preserve previously confirmed data on partial request corrections, and preserve the associated open lead when a repeat call is corrected.
- Remaining external gates: reviewed privacy/retention policy; a controlled transfer receiver/no-answer test; broader real-call scenario matrix within the approved $5 limit; a new isolated demo assistant/number with separately authorized restricted key scope. No public demo or customer activation is implied by these internal successes.

## Voice acceptance continuation — 2026-10-06

- Production remains the older stable release at 6d36aa454241588140a3d9945eed1a5696a65db6. PR #5 remains draft/unmerged. No production checkout, customer telephony, tax, live Stripe or overage activation.
- Verified Preview code: a953a0e6d8e86d6627ef1c4c5592e12de1c46a56; immutable URL https://my-ai-website-n5djcvya9-mohamtaj004bas-projects.vercel.app. Stable feature alias remains https://my-ai-website-git-feature-caller-d75cb2-mohamtaj004bas-projects.vercel.app.
- Exact checks for that SHA: CallerCore CI 37524520062 and 37524527675 success; CodeQL 37524520020 and 37524526097 success; Browser QA 37524520019 success. Artifact 11442312154: 279 layout contracts, 188 readability contracts, 490 screenshot checks, 479 PNG files; no console/page/API/visual failures. Voice fixtures passed at 1440/768/390/320 widths, including policy preservation and disabled controls after failed verification.
- Actual telephone acceptance: wrong-number call ending 5a1a (v8, 25 seconds) completed non_customer and endCall; FAQ-only call ending 4abab (v9, 35 seconds) answered service area/hours directly, completed resolved_by_ai, and ended itself. Canonical FAQ record: 36 seconds, no additional lead or follow-up. Complaint call ending 6406f (v9, 145 seconds) saved a confirmed message, declined to promise a same-day visit and ended itself. These are controlled fictional calls, not customer traffic.
- Provider-backed controls: one current-state read timed out with VOICE_PROVIDER_TIMEOUT. UI disabled controls and did not claim readiness. Save/configure recovery succeeded, then pause and resume both passed provider read-back. Fallback was the controlled QA number +15098718078; the main internal line was restored to ready. This proves provider routing changes, not human pickup or no-answer recovery.
- New refinements: non_customer calls have a truthful non-customer category and are excluded from the dashboard contact directory; reconciliation is tenant-checked, capped at five records and a 20-second batch deadline; failed records stay queued. Complaint listening exposed unnecessary repeated intake and generic review wording, so the speaker instructions now require concise saved-request confirmation and direct explanation of unavailable schedule access.
- Local suite after these refinements: 1,777 passed, zero failures. Publication and exact-SHA browser/security checks for the follow-up commit must be recorded separately.
- Prepared inactive isolated demo resources: workspace voice_test_3c9bf794a9c248978797ecc7e457d2ef; Vapi assistant a868a52d-eef7-4760-8b47-3d5d93eed420; free number resource 89b79ce9-af0d-494f-9177-de235d420d7a (+15095173131). No inbound assistant assignment or public website exposure. The existing legacy public demo is untouched.
- External access blocker: the approved persistent Preview key is restricted to the internal assistant only. Demo synchronization requires owner approval to add ONLY the new isolated demo assistant to that key scope (or create a separate equally restricted Preview credential). Keep transient assistants disabled; do not grant organization-wide assistant access. Resource IDs may then be added only to feature-branch Preview.
- Real-call matrix is incomplete: configured human transfer/no-answer behavior, after-hours telephone acceptance, broader failure/acoustic testing, and isolated public-demo acceptance remain unverified. GPT-Live blind transfer must not be presented as verified human connection or guaranteed no-answer fallback. Recording remains off; transcription disclosure/retention/legal review remains pending. Customer activation and demo public-number exposure stay gated.
- Credit guard: initial account balance 10.23; fresh balance 7.42 before complaint ($0.49 total across both legs). Approximate test use 3.30 of the approved $5; refresh provider balance before further paid calls.

## Voice continuation checkpoint — 2026-10-06, owner feedback and recovery

This checkpoint supersedes the earlier inactive-demo/access/budget notes above.

- Release boundary: feature/callercore-dashboards only; PR #5 remains draft/unmerged. Public Production remains the older stable release at 6d36aa454241588140a3d9945eed1a5696a65db6, deployment dpl_4d13ERbPnK5gW4cBJjFMDUHNW1wY. No live checkout, live Stripe changes, subscription activation, tax, overage billing, customer telephony or recording activation. Preserve completed Stripe sandbox acceptance.
- Current tested runtime: de41f997454a1144f11f68da9554c150c556b358; immutable Preview https://my-ai-website-icbxbq6fz-mohamtaj004bas-projects.vercel.app, deployment dpl_2JG7u8pCDEUpf6QddfUZxNfdB43G. Stable feature alias: https://my-ai-website-git-feature-caller-d75cb2-mohamtaj004bas-projects.vercel.app.
- Conversation architecture: GPT-Live speaker plus GPT-5.6 Terra reasoner, with workspace-bound CallerCore tools and canonical CRM results. Instructions are behavior boundaries and approved knowledge, not a fixed two-line call script. The latest prompt replaces accumulated directives with a coherent conversation policy: understand the request before identity collection, reuse supplied details, answer approved routine knowledge directly, distinguish opening hours from calendar availability, avoid generic “team will review” confirmations, listen to corrections and interruptions, and handle goodbye spoken during request saving.
- Verified call-start hours context: CallerCore computes current opening/holiday status in the business timezone and injects it through the provider adapter's thinking-context control. A 30-second boundary check across the maximum call duration prevents treating a soon-changing status as valid for the whole call. Delivery is claimed once per canonical call, reported as submitted/unconfirmed, and never retried blindly after an uncertain control request. Secure-tool fallback remains available. Unit/integration tests prove context scoping, one-attempt behavior and malicious control URL rejection. Actual speech delivery of this new context remains UNVERIFIED.
- Sync recovery: the internal configuration update became unconfirmed after the provider applied it. Read-back matched both the complete assistant configuration and number routing, but the previous error state persisted. The new verification code clears that error only after both checks and the agent-revision guard pass; mismatched settings, routing and stale agent revisions stay blocked. Actual internal recovery now passed provider read-back.
- Internal resources: workspace voice_test_c62327723c4e4495a120c6aba96a2a28; assistant c3f3150b-f3d9-411b-992c-4c3378bda984; controlled number +15094089058. Normal Monday–Friday 09:00–17:00 America/Los_Angeles hours are restored and verified. Temporary closed-hours test configuration has been removed.
- Access completed with explicit owner approval: “CallerCore Preview voice + demo” private key is restricted to exactly the internal and isolated demo assistants, with transient assistants disabled. Stored only as a write-only branch-specific Preview secret; no secrets in Git or chat. The prior internal-only key remains a rollback credential; no unapproved revocation or scope expansion.
- Isolated demo resources are now configured and provider-verified: workspace voice_test_3c9bf794a9c248978797ecc7e457d2ef; assistant a868a52d-eef7-4760-8b47-3d5d93eed420; number 89b79ce9-af0d-494f-9177-de235d420d7a, +15095173131. Uses the same secure tools and canonical processing as internal calls, a five-minute cap, recording off, fictional-data disclosure, no transfers, no actual booking/dispatch/payment or real callback promises. Legacy public demo resources remain untouched.
- Public demo number disclosure remains closed. Provider configuration alone is not acceptance. Number-level abuse controls, real-call acceptance and disclosure/retention review must have independently recorded evidence; no fake acceptance record was written.
- Owner internal call at 14:12 PDT (v14, ending 2ae4d): 101 seconds, $0.18; request saved and complete_call/endCall succeeded after an explicit goodbye. Conversation quality FAILED: owner said “horrible”; excessive checking/reciting hours, asking identity before understanding the change, and confusing opening-hours lookup with appointment availability. Do not count this as passing voice acceptance.
- Owner demo call at 14:15 PDT (v3, ending 40789): 177 seconds, $0.31; service area answered, correction from faucet to toilet preserved, request saved without promising availability. The assistant did not hang up after goodbye; owner ended the call. Conversation and ending acceptance FAILED. Canonical demo inspection: one phone call, one contact, one lead, one open follow-up, 2.95 usage minutes. Two save attempts did not create duplicate leads; summary retained the correction and no false confirmed appointment.
- Prior controlled after-hours call 01a112f8-b575-7ccf-a68a-e18e3557fb94: 78 seconds, request saved, but ended while caller asked whether Friday was actually available. A saved result must not authorize hangup; new caller questions cancel closing. The corrected post-save availability-question scenario still needs an actual phone retest.
- Automated PSTN retest 01a1130c-20b7-788e-a9ea-d2534ca133fe failed before connection with call.start.error-vapi-number-outbound-daily-limit, $0.00. No connected call or canonical successful record. Do not bypass the provider cap by cycling caller numbers. Incoming test calls remain possible; the owner is unavailable for several hours.
- Budget: explicit owner approval increased the TOTAL controlled acceptance limit to $8, not $8 additional. Latest observed Vapi balance 5.77 against initial 10.23 (approximately $4.46 consumed, conservatively including unrelated legacy inbound usage). About $3.54 remains; refresh balance before paid calls. No credit purchase or recurring charge.
- Local suite on this runtime: 1,796 tests passed, zero failures. CallerCore CI 37539720342 (push) and 37539726196 (PR) passed; CodeQL 37539720373 (push) and 37539726173 (PR) passed. Exact-SHA Browser QA 37539720410 passed, artifact 11448248729: 279 layout contracts, 188 readability contracts, 490 screenshot checks and 479 PNGs; zero console/page/API/visual failures. Voice operations at 1440/768/390/320px had no horizontal overflow or small targets; authenticated admin checks passed. These checks used fixtures and did not place real calls.
- Final readiness guard verifies the intended reasoner effort and all mandatory provider lifecycle callbacks, including call-end results. Missing callbacks cannot be marked ready. Both internal and isolated demo assistants passed actual provider read-back on this runtime; recording remains off and real-call acceptance remains unverified.
- CodeQL completed successfully but its diagnostic report identified one redundant identity replacement in the test-only module loader (js/identity-replacement, tests/voice-integration.test.js:251). Removed that no-op without changing production code; all 61 voice integration tests pass afterward. The checkpoint commit contains only documentation and this test-helper cleanup, preserving the verified runtime.
- Guarded resume: verifies the workspace agent revision and complete live assistant configuration before reconnecting, and checks them again after routing read-back. Drift before reconnection causes no routing mutation; drift during it leaves an error, not falsely ready. Latest actual internal pause/resume on dd6667857e1df69dd714aa2e5b2dc247cf7af410 passed both provider routing read-backs; normal answering was restored. The approved fallback was the controlled QA number +15098718078. This does not prove human pickup or no-answer handling.
- Concrete latency finding from demo call 01a11312-7298-7000-a82f-295879140789: first save tool took 8,446.9 ms and returned unconfirmed; retry took 1,167.9 ms and completed. Vercel logged VOICE_PROVIDER_TIMEOUT at 21:18:27.958Z in /api/voice-webhook. The slow step was the provider call-verification read, before tool execution; do not attribute this solely to speaker wording.
- Latency/recovery fix: live tool call-verification GETs now use at most two 1.5-second attempts, retaining provider-backed call/assistant/number association checks. Only transient read transport/5xx failures retry; access denial, rate limits and malformed data do not. Uncertain provider writes are never automatically retried. A failed pre-action verification returns an explicit tool error that no new action started on this attempt, preserves uncertainty about prior attempts, and allows one retry without repeated intake. Tests cover the actual timeout deadline, safe read retry, no write retry, no CRM mutation on failure, and association denial. Actual phone experience on this fix remains unverified.
- Runtime dd6667857e1df69dd714aa2e5b2dc247cf7af410 passed Browser QA 37537089160 (artifact 11447770934); runtime de233d0333467f928e7ad9012444d20344d4bc39 passed Browser QA 37535881203 (artifact 11445789192). These prior checks do not substitute for the current runtime's final browser report or actual call retest.
- Previous conversation runtime 47ad587ef864bef303889bc9caedf0eb84f432a5 passed Browser QA 37533959304, artifact 11446740429: 279 layout contracts, 188 readability contracts, 490 screenshot checks, 479 PNG files; zero console/page/API/visual failures. These are browser/fixture checks, not acoustic telephone acceptance.
- Saved-call notifications use the same canonical phone records and current follow-up state as the client dashboard; integration tests exercise the actual notification builder and preferences/failure handling. Delayed call artifacts remain durably queued; manual reconciliation is capped at five records and a 20-second batch deadline. An automatic reconciliation worker is still separate future operational work.
- Remaining acceptance gates: actual retest of the new conversation/context/goodbye policy; post-save follow-up question; controlled human transfer/no-answer/invalid-destination behavior; wider interruption, correction, emergency and recovery matrix; demo number-level abuse proof; transcription disclosure/retention/legal review. GPT-Live blind transfer is not proof of human pickup or guaranteed no-answer fallback. Do not mark the voice phase fully complete or activate customers/public demo.
- Smallest external next step after the provider cap resets or owner returns: run a focused actual call asking “are you open,” requesting an estimate or appointment change, asking whether Friday is genuinely available after the save, and saying goodbye; then inspect context delivery, transcript, end reason, canonical request, notification and usage. A controlled transfer receiver is also needed. No new broad credential approval is required.

### Acceptance sequence for the next real-call window

Do not restart Stripe acceptance. Do not change Production. Read the current Vapi credit balance and retain the total $8 cap. Do not publish a stale Vapi editor draft: use CallerCore saved settings and provider read-back as the configuration source.

| Check | Current evidence | What remains |
| --- | --- | --- |
| Opening disclosure and approved FAQ/service-area answers | Earlier controlled calls connected and answered; owner reports static mostly gone | Retest latest conversation policy and disclosure under interruption |
| Current opening hours | Secure hours lookup was exercised; call-start context has unit/integration coverage | Prove new thinking-context submission and direct spoken answer on an actual call |
| Estimate intake and caller correction | Demo produced one corrected toilet lead/contact/follow-up, without a false booking | Judge latest natural wording, address relevance and confirmation economy |
| Request saved while caller says goodbye | Previous demo save completed after a timeout/retry; assistant did not end | Verify a goodbye during saving is honored once the save resolves |
| Post-save availability question | Previous internal call incorrectly ended on a new question | Verify it stays on the line, explains calendar limits directly, then ends on goodbye |
| Wrong number and routine resolution | Earlier canonical non-customer/resolved calls created no unnecessary follow-up | Retest latest policy; compare call/contact/follow-up counts |
| Complaint, ETA and incomplete details | Earlier complaint was captured without promised attendance | Latest natural response and proportionate clarification remain unverified |
| Pause/resume | Actual provider routing changed and read-back passed; latest resume checks complete settings too | Human pickup and no-answer behavior are separate acceptance tests |
| Human transfer and transfer failure | Secure adapter, destination/timezone guards and single-attempt journal covered by tests | Controlled receiver, invalid/no-answer destination and actual transfer outcome |
| Delayed artifacts, retries and usage | Durable queue, bounded reconciliation, idempotent CRM and 177-second/2.95-minute demo result | Verify latest real call, exact saved result/notification and no duplicate usage |
| Public demo exposure | Isolated resources configured; public disclosure remains closed | Internal/demo acceptance, number-level abuse proof and disclosure/retention review |

For each new call record the provider/canonical call IDs, runtime SHA, assistant version, duration/cost, disposition, corrected request, contact/lead/follow-up counts, notification destination, usage delta, end reason and owner quality feedback. Browser/fixture success is never acoustic acceptance. Do not write an acceptance flag merely because the call connected or a unit test passed.

## 2026-10-06 Preview voice recovery and operations checkpoint

- Owner requested autonomous completion of nonblocked work and explicitly deferred telephone quality retesting. No paid calls, provider scope changes, customer activation, Stripe changes or Production deployment were performed in this checkpoint.
- Delayed transcript/result recovery uses a workspace lease, ownership-checked release, fair cursor and bounded five-call batch. A permanently failing call no longer starves later pending calls. Canonical processing remains atomic and idempotent; actual processor tests prove one call record and one usage allocation after repeat recovery.
- Authenticated ended-call events schedule two bounded background recovery attempts using Vercel waitUntil. Background errors or registration failure cannot change an already-saved webhook response to failure. This is request-lifetime, opportunistic recovery, not a persistent scheduler; interrupted work stays in Redis.
- Added Preview-only POST /api/voice-maintenance, authenticated with the existing server webhook credential, rate limited and restricted to server-designated internal/demo bindings. Caller-supplied workspace selectors are rejected. No Production cron was installed. A recurring Preview-only scheduler remains unconnected.
- Admin inspection reports safe recovery counts and the last check without provider IDs or errors. Voice operations locks controls during requests and invalidates loaded settings on workspace changes, preventing stale settings from being applied to another workspace. Existing drafts survive errors.
- Transcript secret redaction now covers private automation, database, Redis and callback credentials, matching longest values first. Public keys and ordinary business information remain readable.
- Verification: 1,816 local tests passed with zero failures, cancellations or skips; git diff whitespace checks passed. Exact-commit hosted CI, CodeQL and browser QA are pending publication of this checkpoint and must not be reported as passed from older evidence.
- Remaining: latest actual-call conversation/goodbye quality, controlled human-transfer/no-answer acceptance, demo number-level abuse proof, transcription/retention/legal review, persistent Preview scheduling and hosted verification for this checkpoint. Public demo disclosure and customer telephony remain gated. PR #5 remains draft/unmerged. Public Production remains the older stable release.


### Hosted verification completed for the recovery checkpoint

- Verified runtime: 101f593ae7452ece46e4de231026b64c687dd6d1. Immutable Preview: https://my-ai-website-bntut8oj9-mohamtaj004bas-projects.vercel.app; deployment dpl_9iHvowewZCtcM7GYqHSoJDqrinkh, READY. Stable feature alias: https://my-ai-website-git-feature-caller-d75cb2-mohamtaj004bas-projects.vercel.app.
- CallerCore CI 37546203117 passed. CodeQL 37546202887 passed; diagnostic job 112550704357 reported Total SARIF results: 0.
- Browser QA 37546198360 passed; artifact 11450703269: 279 layout contracts, 188 readability contracts, 490 screenshot checks and 479 PNGs. Zero console, page, API or visual failures. Voice controls passed 1440/768/390/320px layouts, policy preservation, failed-verification and workspace-switch guards. Authenticated admin passed. Browser fixtures placed no real calls.
- Actual authenticated admin checks on this runtime: internal recovery preserved 14 calls, 3 contacts, 5 leads, 12 open follow-ups and 24.73 minutes; demo recovery preserved 1 call/contact/lead/follow-up and 2.95 minutes. Both recovery checks reported saved details up to date. Both assistants passed provider read-back. Controls were visibly disabled during requests and immediately invalidated on workspace changes. No new telephone calls were placed or assistant settings changed.
- Production rechecked unchanged: dpl_4d13ERbPnK5gW4cBJjFMDUHNW1wY, SHA 6d36aa454241588140a3d9945eed1a5696a65db6. PR #5 remains open, draft and unmerged. The subsequent documentation checkpoint changes no application code; runtime acceptance evidence above remains tied to 101f593ae7452ece46e4de231026b64c687dd6d1.
- Outstanding external work remains exactly the deferred actual-call quality/transfer scenarios, number-level demo abuse acceptance, privacy/disclosure/retention review and connecting an approved Preview-only recurring scheduler to the prepared authenticated maintenance endpoint. Public demo disclosure, customer activation, recordings and automatic overage billing remain closed. No new credential approval is needed for the existing internal/demo test resources.


## 2026-10-06 Public demo release guard hardening

- A focused autonomous review found that future-dated provider verification and truthy non-boolean acceptance values could pass the public demo release gate. Tightened the gate to require fresh, finite, non-future verification, a positive integer settings revision, explicit boolean acceptance, matching canonical call identity, verified duration and an active isolated workspace.
- Added regression coverage for malformed evidence, stale/future timestamps, inactive or mismatched workspaces and call records. All 1,819 local tests pass. Test acceptance records exist only in in-memory unit fixtures; no actual acceptance evidence or release flags were created.
- No assistant configuration, credentials, phone routing, recording, payment or Production changes. Public demo disclosure remains gated. Actual phone quality/transfer testing and privacy review remain deferred. This backend-only hardening does not establish new acoustic acceptance.


### Demo availability experience follow-up

- Browser verification of guard runtime 6934c2b8e56a46eef73fb4c09a07c17aeae2279f confirmed the public line remained unavailable, but revealed an unhelpful generic retry message after clicking Check demo availability. Fixed the public experience to retain clear unavailable/rate-limit/network explanations and dashboard/contact alternatives. No automatic retries, leaked number or provider activation.
- Actual inline-page regression tests exercise token failure, number failure, rate limits, network errors and successful verified-number reveal. Combined local suite: 1,822 passing tests, zero failures. Provider acceptance and legal review remain unverified; unit fixtures are not actual acceptance evidence. Production remains unchanged.

### Voice-aware recovery export implementation

- Closed the identified export coverage gap with lib/voice-export.js and integration into both authenticated workspace export routes. The versioned section includes configuration, contacts, canonical calls, retry journals, usage ledger, pending recovery and follow-up state.
- Exports fail closed on missing or foreign canonical records, duplicate IDs, malformed contacts/usage, incorrect call-to-usage association and concurrent source changes. Reads are batched; no provider calls, new credentials or activation side effects.
- Older phone-history exports without canonical voice state remain readable but are not classified as complete recovery sources. Restored voice resources require separate provider reconciliation.
- Recovery rehearsal verifies serialized journals prevent repeated mutations. This is not a managed database backup/PITR restoration, customer activation or phone-quality acceptance.
### Voice retention safeguard and observed cost checkpoint

- Runtime 0e4ab7e0db746afb6a189a1543e10293662d098b is verified on immutable Preview https://my-ai-website-2xp5zpzh1-mohamtaj004bas-projects.vercel.app. CI 37550173848 passed; CodeQL 37550173819 reported zero SARIF findings; full Browser QA 37550169989 passed. Hosted admin export check reported 15/15 sections and explicitly stated that no database restore was performed.
- A sample-workspace download during automated QA was refused because the workspace changed mid-export; runtime logs confirmed the concurrency guard. No partial export was downloaded. Raw real-test-workspace download was not independently captured through browser tooling.
- A further privacy review found that the legacy permanent-purge journal does not include canonical voice data or provider bindings. Added a fail-closed guard before any new or resumed purge when voice state is present or cannot be read. No actual deletion or provider detachment was performed. Full voice-aware retention cleanup and provider detachment remain separate readiness work.
- Combined local suite after the guard: 1,835 passed, zero failed. Latest deployed guard verification will be recorded separately; prior runtime evidence does not claim to cover the guard.
- Added docs/VOICE_OBSERVED_COSTS.md: 14 visible inbound test entries, 1,459 displayed seconds and $2.53 displayed charges; approximately $0.104/minute for that small mixed-revision sample only. Excluded synthetic outbound caller legs from the ratio; they still count toward total test spending. No new calls or credit purchases. Marked the September cost memo historical.
- Production remains on 6d36aa454241588140a3d9945eed1a5696a65db6. Live checkout, automatic overages, taxes and customer telephony remain gated. PR #5 remains draft and unmerged.