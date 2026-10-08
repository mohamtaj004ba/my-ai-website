# CallerCore project state

Updated October 8, 2026. Canonical planning/review handoff. This document replaces accumulated chronological status entries; linked acceptance reports retain detailed evidence. “Verified” always refers to the scope stated, never implicit customer or Production activation.

## 1. Current branch / release state

- Repository: mohamtaj004ba/my-ai-website.
- Development branch: feature/callercore-dashboards. PR #5 was rechecked open, draft and unmerged.
- Current published documentation checkpoint: c4e8575ec7f43176b94ec5decdd4e6a68f2b358e. Its READY Preview: https://my-ai-website-hsldoddsj-mohamtaj004bas-projects.vercel.app (dpl_DdEYyfpKPvmZyZFxmaDfdfGxMN5S).
- Latest fully accepted application runtime: de290558a7c3685018e2e63a72f33bbdf1c0b7a6. Immutable Preview: https://my-ai-website-q64uywptu-mohamtaj004bas-projects.vercel.app (dpl_6idJVwvXY2GdiL2bGxHgzfFoTkHy).
- Stable branch Preview: https://my-ai-website-git-feature-caller-d75cb2-mohamtaj004bas-projects.vercel.app. An alias can move; exact acceptance belongs to the immutable runtime above.
- Production rechecked unchanged: https://www.callercore.com/; READY deployment dpl_4d13ERbPnK5gW4cBJjFMDUHNW1wY, SHA 6d36aa454241588140a3d9945eed1a5696a65db6. Production intentionally trails Preview.
- October 8 recovery-only authentication changes are preserved locally, NOT yet committed/deployed/hosted-verified: api/voice-maintenance.js, scripts/voice-maintenance-runner.mjs, tests/voice-maintenance-auth.test.js. Do not confuse this handoff commit with deployment of those edits.

## 2. Completed work carried forward from this conversation

### Public website and product presentation

- Refined pricing card focus/hover movement, premium mobile header/navigation, dismissal/focus behavior, readable public layouts and phone/tablet/laptop sizing.
- Replaced repetitive industry presentation with distinct industry imagery and business-specific content. Revised call examples and receptionist copy; conversational quality is not certified by marketing scripts.
- Added detailed privacy, terms and cookie pages/preferences; choices persist rather than repeatedly leaving an overlay.
- Dashboard showcase uses stacked sample screens with transitions; enlarged previews retain easy dismissal and image interaction. Screenshots explicitly represent example data, not active customer operations or production readiness.
- Improved public demo unavailable/failure/rate-limit explanations and alternative actions; removed reliance on obsolete walkthrough destinations.
- Keep unsupported savings claims out of copy. Observed test-call cost evidence is a small mixed-revision sample, not a customer savings guarantee or another estimate calculator.

### Customer/admin experience, billing and onboarding

- Native signup/payment and first-party billing interface; canonical payment status, recoverable failure states, server-verified fulfillment, invoice access, payment-method updates, plan changes and subscription cancellation/reactivation/ending.
- Actual Stripe sandbox acceptance completed, including setup fee, failure/recovery, replay, isolation, email capture and security. Temporary acceptance access/harness removed; webhook restored.
- Client/admin mobile layouts, keyboard-safe Intelligence, readable rich answers, navigation/details outside dismissal, compact filters, notifications, labelled operational status and global search preserved.
- Consequential admin confirmations retain context/revision guards, atomic audit, request locking and recoverable errors.
- System Health distinguishes operational services, configuration, verification, launch gates, owner actions and actual failures. Sandbox billing acceptance cannot override a failing environment check or authorize Production sales.

### Voice, backend, reliability and recovery

- Provider-neutral CallerCore layer with initial Vapi adapter, saved GPT-Live assistants, authenticated workspace-bound tools, normalized call results, CRM associations, follow-ups, notifications and usage journals.
- Configurable business knowledge, timezone/hours/holiday policies, routing, transfer rules, greeting/tone/disclosure and prohibited claims; guarded provider sync/read-back and actual controlled pause/resume verification.
- Routine knowledge delivered as call context; improved correction, post-save context and goodbye behavior. Reduced call-verification reads to bounded safe attempts; uncertain writes are not blindly retried. Latest telephone quality remains unaccepted.
- Delayed results persist with a fair recovery cursor, ownership-checked lease, bounded batches and opportunistic Vercel background attempts. Canonical journal processing prevents repeated CRM/usage mutations.
- Recovery exports include voice configuration, calls, contacts, processing journals, pending recovery, usage and follow-ups. Missing/foreign/concurrent sources fail closed; secret redaction and provider-reconciliation requirement remain enforced.
- On-page exports preserve the screen, reject malformed/stale downloads and prevent duplicate actions.
- Administrator retention review is read-only, aggregate-only and workspace-scoped. Voice-bearing permanent purge fails closed pending complete cleanup/provider detachment.
- October 8: isolated Preview Redis Daily Backup verified enabled, latest one-day retention. Manual baseline callercore-preview-baseline-20261008 completed, 7.49 MB, provider timestamp 2026-10-08T00:12:37-07:00. No restore performed.
- Approved backup rate $0.25/GB-month and $1/month budget. This is an owner spending limit, NOT a verified provider-enforced hard cap. No plan upgrade.
- Created free US QStash resource callercore-preview-recovery, resource ef5c0de4-c504-4d67-826b-6bac35bc333b, region iad1. Skipped project connection to avoid broad environment injection. No recurring schedule/delivery acceptance yet.
- Created separate sensitive branch-Preview maintenance credential. Existing callback credential preserved. Local endpoint/runner changes limit this new credential to maintenance and pass eight targeted checks; publication and scheduled-delivery proof remain engineering work, already authorized.
- Superseded: “Stripe acceptance pending,” “no populated voice exports,” and “Preview Daily Backup off.” Do not repeat these as current blockers.

## 3. Current verified system status

| Subsystem | Status | Verified scope / remaining boundary |
| --- | --- | --- |
| Public website | complete/verified | Published Preview UI/browser evidence; public Production remains older stable |
| Client dashboard | complete/verified | Authenticated Preview flows and responsive checks; physical-device acceptance separate |
| Admin dashboard | complete/verified | Preview operations, inspections, context guards and health classifications |
| Stripe/billing | complete/verified | Actual sandbox lifecycle only; live collection/activation closed |
| Onboarding | implemented but not fully verified | Sandbox paid fulfillment verified; full paid-customer-to-activated-phone journey not accepted |
| CRM | complete/verified | Canonical isolated real-call contact/lead/history/follow-up mutations and replay; broader cross-channel roadmap deferred |
| AI Intelligence/help | complete/verified | Isolated real OpenAI proposal/save/replay/read-only checks; scoped authorization; not voice acoustic acceptance |
| Vapi/voice provider | implemented but not fully verified | Real restricted internal/demo resources, callbacks and read-back; full failure/actual-call matrix incomplete |
| GPT-Live/receptionist | implemented but not fully verified | Real intelligence behind calls; latest naturalness, post-save answers and ending quality not accepted |
| Phone numbers/routing | implemented but not fully verified | Real isolated internal/demo numbers assigned; customer activation closed |
| Transfers | partially implemented | Guarded blind attempts and journal; real human pickup/no-answer/invalid destination matrix open |
| After-hours | implemented but not fully verified | Workspace timezone/hours/holiday logic tested; latest closed-office call quality failed owner review |
| Pause/resume | complete/verified | Actual controlled internal provider routing read-backs plus stale/revision guards; not customer deployment |
| Transcripts/call results | complete/verified | Actual isolated calls normalized, journaled and exported; delayed/missing artifact recovery tested |
| Usage accounting | complete/verified | Canonical duration/allocation deduplicated; no automatic overage charging |
| Backups/recovery | partially implemented | Managed baseline completed, daily enabled, populated exports validated; managed restore and recurring schedule unverified |
| Notifications | implemented but not fully verified | Canonical in-app call/follow-up and sandbox billing email evidence; all live external delivery channels not certified |
| Security | complete/verified | Accepted runtime CI/CodeQL/auth isolation/redaction/browser checks; new local credential patch needs hosted checks |
| Mobile/responsive | complete/verified | Browser emulation at multiple sizes; actual physical devices not verified |
| Demo line | implemented but not fully verified | Real isolated call saved; public number reveal gated by acceptance/disclosure/abuse evidence |
| Production readiness | blocked | Explicit launch gates and actual voice acceptance remain; public website is live, commercial voice service not launched |

## 4. Real versus mock / seeded / not live

- REAL provider-backed: isolated Vapi internal + demo assistants/phone numbers, actual inbound PSTN calls, real OpenAI Intelligence checks, actual Preview Redis records, completed managed backup.
- Internal test number (509) 408-9058; isolated workspace voice_test_c62327723c4e4495a120c6aba96a2a28.
- Demo test number (509) 517-3131; isolated workspace voice_test_3c9bf794a9c248978797ecc7e457d2ef. Do not expose it as publicly accepted.
- SANDBOX provider-backed: Stripe test subscriptions/payments/invoices/webhooks. No real customer collection.
- SEEDED: fictional dashboard businesses, sample customer records and controlled browser test workspaces. Marketing dashboard pictures remain sample images.
- SIMULATED: unit providers/transaction doubles, automated UI fixtures, failure/transfer scenarios and emulated device geometry. Browser QA did not place telephone calls.
- UI-only or not live: marketing illustrations/showcase; customer live telephony and commercial activation remain off. No automatic calendar appointment booking, SMS service or automatic overage billing.
- REAL infrastructure but not operationally accepted: new QStash resource; no schedule installed or deliveries verified. New sensitive maintenance credential exists in branch Preview but application changes accepting it are local only.
- Technical configuration/read-back does not establish legal approval, telephone quality, human pickup, restore success or public release readiness.

## 5. Test / QA evidence

Latest FULL hosted runtime evidence: de290558a7c3685018e2e63a72f33bbdf1c0b7a6.

- Local suite: 1,852 passed, zero failures.
- CallerCore CI run 37554473722 passed.
- CodeQL run 37554473654 passed, zero SARIF findings.
- Full authenticated Browser QA run 37554469549 passed; artifact 11454378158 downloaded and report inspected.
- 279 layout checks; 188 readability checks; 494 screenshot checks; 483 PNG files. Zero console/page/API/visual failures.
- Voice fixture states covered 1440/768/390/320px; realCalls:false/providerActivated:false.
- Actual signed-in internal export: 14 calls, 14 journals, 14 usage entries, 3 contacts, 5 leads, zero pending recovery, 1,484 connected seconds. SHA-256 52b7330a7ef61f10c4a3a8cc57b6cdeff19bf773fa38a326a0313ac82c219e18.
- Actual demo export: 1 call/journal/usage/contact/lead, 1 follow-up, zero pending recovery, 177 connected seconds. SHA-256 b49dac3f3692761990118294d3c3aaf5878bcb78624e27fdcb64118cebfdd8a2. Raw downloads private and not committed.
- Both actual retention reviews: zero old-content/recording/metadata, unknown-date or active-call candidates; no deletion.
- Stripe acceptance implementation 70a550d28f45189815e9176c95a72af3c2546b5c: 1,703 tests recorded in STRIPE_SANDBOX_ACCEPTANCE.md and Browser QA job 112127970115. Do not substitute earlier reported 1,701 for this exact report.
- Real calls established connection, routine answers, corrected request capture, CRM/usage and explicit endCall on selected revisions. Exact latest records above are evidence, NOT a passed comprehensive scenario count. Latest owner quality review was negative; fresh acceptance deferred.
- Recovery: real populated export validator passed; stateful in-memory actual-handler configuration round-trip and journal replay tests passed. No managed database restore, PITR or provider reconnection rehearsal performed.
- October 8 new local maintenance authorization/runner tests: 8/8 passed. Full local suite including this patch: 1,854 passed, zero failures/cancellations/skips; this is local evidence only. No new CI/CodeQL/Browser QA or scheduled delivery result claimed.
- Managed baseline backup creation completed; first automatic daily execution not independently observed.
- Earlier acceptance specifics remain in docs/VOICE_PREVIEW_RUNBOOK.md and docs/STRIPE_SANDBOX_ACCEPTANCE.md. Their chronological entries can contain superseded blockers; this document governs current status.

## 6. External actions / approvals genuinely needed

| Action | Why / scope | Smallest next step |
| --- | --- | --- |
| Resume actual phone quality retest and provide controlled transfer receiver | Deferred owner participation; blocks voice acceptance/launch, not current engineering | Focused open-hours/request/correction/post-save availability/goodbye call, then controlled human/no-answer transfer |
| Approve separate disposable database restore target and destructive restore step | Needed for managed restore proof; does not block ordinary development | Select isolated target and authorize restoration there, never active Preview/Production |
| Decide transcription/disclosure/retention/holds and recording policy with appropriate review | Launch and destructive cleanup boundary; recording stays off | Review actual supported behavior and approve policy before release/deletion |
| Final business/entity/tax, pricing/fair-use, support delivery and commercial release authorization | Launch only; technical success cannot authorize sales | Resolve owner checklist, then separately authorize narrowly defined Production changes |
| Supply physical phone/tablet access or perform checks | Needed for real-device acceptance; not an engineering blocker | Review menu, keyboard and image preview on actual devices |
| Authorize customer telephony / full customer activation test when ready | Isolated tests do not permit customer activation | Approve one defined journey after voice/legal acceptance |

No further owner approval is needed for the already approved Preview backup or recovery schedule. Finish its implementation and delivery verification autonomously. Existing restricted internal/demo provider access is available; no broad new credential request needed. Public demo number-level abuse/disclosure acceptance remains required before exposure.

## 7. Remaining priorities in execution order

1. Publish and hosted-verify the preserved recovery-only authentication patch; keep existing webhook/tool access unchanged.
2. Install approved five-minute QStash POST schedule against the exact stable branch Preview maintenance endpoint; empty body, restricted credential, bounded timeout and no blind retry. Verify recurring deliveries and unchanged canonical call/usage counts.
3. Observe first automatic daily backup; monitor approved $1/month backup budget without claiming an unenforced hard cap.
4. Perform separately approved disposable managed restore and provider-independent recovery validation; never auto-reconnect restored assistants.
5. When owner resumes participation, finish focused latest telephone conversation/goodbye/post-save acceptance.
6. Complete controlled real transfer/failure/no-answer and remaining actual-call scenario matrix; record definitive outcome.
7. Complete demo number-level abuse controls and disclosure/acceptance proof before public reveal.
8. Resolve retention/holds/disclosure policy; implement provider-aware deletion only within an approved disposable scope.
9. Complete physical-device checks and full sandbox customer onboarding-to-phone journey within separately authorized activation scope.
10. Perform explicit release review; keep all commercial/Production gates closed until owner authorizes them.

Conditional post-launch work: multi-user roles, relational datastore migration, wider cross-channel contacts, Gmail push/history, external notification channels, calendar/SMS and campaigns. These are not silently classified as completed or required for the defined first release.

## 8. Production safety

This run did NOT change main, Production deployment, live Stripe configuration, live checkout, tax settings, automatic overage billing, production credentials or customer Production telephony. Existing isolated Preview test numbers remain real, but no new paid call or customer activation occurred during this backup/handoff work. Recording remains off. Daily backups and new resource/credential affect isolated Preview only. PR #5 stays draft/unmerged. Do not promote accumulated Preview work as part of documentation synchronization.

## 9. Important decisions / architecture to preserve

- Phone/PSTN → Vapi orchestration → OpenAI GPT-Live → secure CallerCore tools → canonical CallerCore data. CallerCore owns settings, CRM, calls/transcripts, usage, billing and audit; raw provider objects remain behind adapters.
- Runtime tools derive authorized workspace from verified provider/call binding; caller-controlled cross-tenant IDs are prohibited. Mutations are schema-validated, idempotent and audited.
- Vercel handles secure APIs/webhooks, not streaming audio. Routine knowledge belongs in call context; “let me check” is not required for already-known basics.
- Appointment/change/cancellation capture is a request, never fabricated availability or confirmed booking. Transfer requested is not human connected.
- Provider read-back, revision checks, locks and truthful failures must survive visual polish. Never replace a verified action with optimistic UI-only state.
- Separate maintenance credential grants less access than the callback key; configuring it supersedes callback authentication for maintenance only. New local patch needs deployment before scheduler use.
- Public demo uses the same isolated core; no customer data/payment/dispatch side effects, five-minute cap, guarded disclosure and separate acceptance.
- Exports are versioned validated snapshots, not provider activation instructions. Managed backup and tested restore are distinct.
- Preserve premium, concise customer-facing copy, easy mobile dismissal and pinch interaction without unnecessary visible image-control clutter.
- No fabricated savings, readiness, legal compliance, real-device evidence or telephone acceptance. Distinguish Preview, sandbox, fixtures and Production throughout.

## CURRENT HANDOFF FOR CHATGPT

- Work only on feature/callercore-dashboards in mohamtaj004ba/my-ai-website; PR #5 is draft/unmerged.
- Production remains the older stable release; no commercial or customer voice activation authorized.
- Latest fully accepted runtime is de290558a7c3685018e2e63a72f33bbdf1c0b7a6; immutable and stable Preview URLs are above.
- Public/client/admin redesigns, sample dashboard stack, responsive layouts and scoped Intelligence are implemented and browser-verified.
- Stripe sandbox acceptance is complete; preserve it and do not restart the billing phase without regression evidence.
- Actual isolated Vapi/GPT-Live calls reach CallerCore tools, CRM, normalized results, notifications and usage.
- Voice quality and comprehensive real-call/transfer acceptance remain incomplete; latest owner feedback was negative.
- Actual pause/resume routing read-backs passed for controlled internal resources.
- Internal/demo populated exports passed validation; records are real test calls, businesses fictional.
- Full latest hosted evidence: 1,852 tests, CI/CodeQL/Browser QA passed, 279 layout/188 readability/494 screenshot checks.
- Managed Preview daily backup is now enabled; 7.49 MB manual baseline completed. No managed restore performed.
- Free Preview QStash resource exists; schedule and delivery proof are not complete.
- Recovery-only sensitive branch credential created; its accepting code and two new tests remain preserved locally, not deployed.
- Next engineering work: publish/verify that patch, install approved five-minute schedule and verify deduplicated recovery.
- Backup and scheduler approvals are already granted; no repeat approval needed for that scope.
- Recording, public demo reveal, live checkout, tax/overage and customer telephony stay gated.
- Owner participation needed later for phone/transfer quality, legal/disclosure decisions, disposable restore and final launch.
- Current status supersedes stale chronological blockers in linked historical runbooks; do not infer readiness from fixtures.
