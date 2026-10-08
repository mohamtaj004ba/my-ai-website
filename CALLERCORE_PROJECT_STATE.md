# CallerCore project state

Updated October 8, 2026. Canonical planning/review handoff. This document replaces accumulated chronological status entries; linked acceptance reports retain detailed evidence. “Verified” always refers to the scope stated, never implicit customer or Production activation.

## 1. Current branch / release state

- Repository: mohamtaj004ba/my-ai-website.
- Development branch: feature/callercore-dashboards. PR #5 was rechecked open, draft and unmerged.
- Remote main rechecked at 37ef5cfcdccae35952822859f64fe83f0b9f09f0; this documentation reconciliation does not move it.
- Documentation baseline reviewed for this reconciliation: e8f96b7d67097b409d3306e03e00b2fd9f0393c7. Its READY Preview: https://my-ai-website-ndj7800tf-mohamtaj004bas-projects.vercel.app (dpl_82JbRcjVvyy3sHEm41VTPTcj7gTB). The reconciliation commit follows this baseline; obtain its own SHA from Git rather than treating the baseline as the new head.
- Latest fully accepted application runtime: bdc31fa7919d1399c3211a6574c3fa3b648945a5. Immutable Preview: https://my-ai-website-ovasbv5o8-mohamtaj004bas-projects.vercel.app (dpl_AC9C9XNe7T6MMbWsYAZQi6ScKAHr). Exact new evidence and rotated-env redeployment are recorded below.
- Stable branch Preview: https://my-ai-website-git-feature-caller-d75cb2-mohamtaj004bas-projects.vercel.app. An alias can move; exact acceptance belongs to the immutable runtime above.
- Production: https://www.callercore.com/; READY deployment dpl_4d13ERbPnK5gW4cBJjFMDUHNW1wY, SHA 6d36aa454241588140a3d9945eed1a5696a65db6. This conversation DID include an explicitly authorized website-only Production release on October 5. Subsequent website/dashboard/billing/voice work remains in Preview; Production intentionally trails it. Do not describe the entire conversation as having never changed Production.
- October 8 recovery authentication patch published at 155c037a1d124d9c0e57bfefdcefaa9a251af409; READY Preview dpl_4qUjE69WvGgLRrwDowEG4Fj1N9X3, https://my-ai-website-pke49bpad-mohamtaj004bas-projects.vercel.app. Further malformed-body hardening follows in the continuation commit. Full hosted acceptance and positive maintenance authentication remain separate.

## 2. Completed work carried forward from this conversation

### Public website and product presentation

- Refined pricing card focus/hover movement, premium mobile header/navigation, dismissal/focus behavior, readable public layouts and phone/tablet/laptop sizing.
- Replaced repetitive industry presentation with six distinct industry pages and imagery, then superseded the transcript experiment with 18 interactive business situations (three per industry). Sticky situation selection, industry-specific tasks and visitor-controlled progression remain; there is no timed conversation carousel or current claim of 36 polished transcripts.
- Added expanded privacy, terms and standalone cookie policy. Removed the automatic cookie popup and floating settings control; optional analytics defaults off and preferences open explicitly from the policy page. Saved choices persist. These documents are implemented, not certified legal advice or completed compliance review.
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
- Created separate sensitive branch-Preview maintenance credential. Existing callback credential preserved. Endpoint/runner accepting changes are now published; the follow-up rejects malformed scalar bodies. Scheduled delivery acceptance remains incomplete; installed schedule is paused pending replacement of a credential exposed during browser inspection. Preview scheduler scope remains already authorized.
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
| Security | implemented but not fully verified | Accepted runtime CI/CodeQL/auth isolation/redaction/browser checks passed within stated scope; maintenance positive-auth/delivery acceptance remains incomplete, and launch/abuse/legal acceptance remains separate |
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
- REAL infrastructure but not operationally accepted: new QStash resource; no schedule installed or deliveries verified. Sensitive maintenance credential exists in branch Preview and accepting application changes are published; secure entry/rotation is needed before scheduled delivery acceptance.
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
- Initial October 8 preserved patch: 1,854 local tests passed; published at 155c037. Subsequent malformed-body hardening: 1,855 local tests and 84 targeted recovery/auth/runner/lease/idempotency tests passed. Exact new hosted evidence is recorded in the continuation checkpoint below; recurring delivery acceptance remains unverified.
- History reconciliation verification: full local suite rerun, 1,854/1,854 passed with zero failures/cancellations/skips. Documentation diff/section/evidence-path checks passed. Only the canonical document is committed; local runtime edits remain separate. This docs-only pass does not claim new hosted browser/provider acceptance.
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

1. Complete positive/negative hosted maintenance authentication after secure entry/rotation of the write-only maintenance secret; accepting code is now published. Keep existing webhook/tool access unchanged.
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
- Separate maintenance credential grants less access than the callback key; configuring it supersedes callback authentication for maintenance only. Patch published and fully QA accepted; hosted credential and delivery acceptance remain separate.
- Public demo uses the same isolated core; no customer data/payment/dispatch side effects, five-minute cap, guarded disclosure and separate acceptance.
- Exports are versioned validated snapshots, not provider activation instructions. Managed backup and tested restore are distinct.
- Preserve premium, concise customer-facing copy, easy mobile dismissal and pinch interaction without unnecessary visible image-control clutter.
- No fabricated savings, readiness, legal compliance, real-device evidence or telephone acceptance. Distinguish Preview, sandbox, fixtures and Production throughout.

## 10. Reconciled material implementation and decision inventory

This inventory consolidates the accessible conversation, including autonomous runs, against current code/tests and retained acceptance reports. “Implemented and verified” below means accepted Preview/runtime evidence plus regression coverage within that scope; it never certifies untested real-device, telephone, legal or Production behavior. Earlier passing counts and Preview candidates are historical milestones, superseded by section 5 rather than summed together.

### Website, sales presentation and customer-facing journeys — implemented and verified in Preview

- Homepage motion illustration replaced the static call card/player. Dark sample dashboard pages are stacked with partially visible headers, hover/click/tap/keyboard switching and transitions. Samples include varied inquiries, billing, existing-customer updates, suppliers and follow-ups; removed production/pending-activation implications from marketing screenshots. A small example-data note remains.
- Full-image viewer starts fitted with surrounding space, keeps Close reachable, supports image-only pinch and two-axis panning, desktop interaction, Escape/outside dismissal, focus return and background-scroll lock. Visible zoom/fit controls were deliberately removed. Browser-emulated checks do not prove every physical phone/browser gesture.
- Pricing focus enlarges and illuminates the selected card while receding siblings. The original default “20 calls/week” estimator was replaced with explicit monthly coverage assumptions; it is not evidence of typical call volume or guaranteed value. No extra ROI/savings calculator was added.
- Industry strip moves, pauses on interaction/offscreen and respects reduced motion. Six industry images and contextual office/tools/workspace imagery complement business-specific content. These are illustrations, not evidence of actual clients.
- Current industry experiences use industry-story.js/CSS and 18 distinct situations; prior two-line examples, playback walkthroughs and longer transcript viewers are superseded. Existing call-types anchors remain. The medical experience concerns administrative support, not PHI suitability or HIPAA certification; legal content does not promise advice. Capturing appointment requests never confirms calendar availability.
- Public naming moved toward “Call answering” and “AI phone assistant”; AI disclosure remains. Legacy receptionist identifiers/routes are preserved for compatibility. Unsupported one-business-day activation, automatic booking and SMS claims were removed. Obsolete demo walkthrough links were replaced with current destinations.
- Footer alignment, anchor offsets, heading spacing, assistant/footer overlap, signup Back styling, step focus, menu focus/Escape and shared-style collisions were fixed across public, sign-in, missing-page, email-preference and checkout-status pages.
- Contact/chat handoff uses a dedicated receipt and “send another message” rather than a lingering form. Saved inquiry versus uncertain notification delivery is explicit. Branded customer communications preserve delivery uncertainty instead of implying unsent data was lost.

### Client/admin dashboards — implemented and verified in Preview

- Shared typography distinguishes readable body text from headings; compact labelled records retain the laptop table layout. Calls become phone cards; Client Care request boundaries, Settings save/cancel actions, Contacts filters and platform grids reflow at narrow widths.
- Mobile navigation, business heading, touch controls, compact account/notification panels, outside dismissal and backdrop cleanup were refined. Opening a notification’s call details clears the previous blur. Closed menus cannot retain offscreen keyboard targets. Read-only admin-client viewing retains its banner and prohibits writes.
- Contacts show compact identities with details/history inside the record. Recorded website sessions live under Contacts; a separate unified live omnichannel inbox was not delivered. Conversation pagination supports later pages rather than presenting a truncated first page as complete history.
- Follow-ups use one status control: red Pending, Completed, Dismissed, with historical In progress information retained and explicit Reopen recovery. Empty filtered lists do not falsely say all work is complete. Leaving a section resets filters; background refresh preserves active filters and unsaved drafts.
- Profile opens as a summary with explicit Edit/Cancel, preserving saved values. Logos retain their proportions. Support categories, including Billing, are inside the support form/sidebar rather than cluttering the header.
- Intelligence stays usable with the mobile keyboard, no forced autofocus, 16px input text and a compact reduced-height layout. Rich headings/paragraphs/lists stack correctly after a response-header CSS collision was fixed.
- Finance charts support keyboard/tap month details, dismissal, edge positioning, restored focus/selection after refresh and hidden-tab resize. Revenue, expense and margin displays remain source-bound; small-screen totals, labels, legends and campaign entries were refined.
- Alerts open the exact call/client/request; stale/malformed notification refresh retains the last verified data. Sync animation means dashboard data synchronization, not verified live phone answering. All existing admin sections and operational fields remain available.

### Backend, Gmail and consequential administration — implemented and verified within accepted scope

- Selective CallerCore confirmation dialogs cover access repair/force logout, configuration override/rollback, phone inventory removal, Gmail disconnect, suspension/resumption and uncertain onboarding email review. Target/revision guards, locks, atomic audit and recoverable errors survive the visual changes.
- Nested dialog focus/backdrop handling, replacement-launcher races and hidden/disabled fallback controls were hardened. A confirmed mutation remains successful when subsequent diagnostics refresh fails.
- Force logout checks current workspace ownership atomically; a changed owner cannot have sessions revoked by stale context. Suspension limits service changes while preserving billing/support access; it does not cancel a Stripe subscription or prove provider routing stopped.
- Existing typed deletion, recoverable workspace deletion and guarded restoration were inherited from the initial handoff and preserved, not newly invented during this run. Voice-bearing permanent purge is now separately blocked pending complete provider-aware cleanup.
- Gmail refresh cannot recreate a disconnected connection or reuse a previous account’s token. Inbox/thread/verified-alias caches are account-scoped; account changes clear stale data, same-account temporary failures preserve useful history, and retries recheck identity after delay.
- Malformed provider results, contradictory aliases, duplicate thread IDs and corrupt cached messages fail closed. Invalid thread caches require fresh reads. MIME handling excludes attachments, prefers nested plain text with HTML fallback, and signals truncated/uncertain content; missing dates are not fabricated as today.
- Replies bind the reviewed account, thread and recipient. Website prospect replies reject changed recipient context. A confirmed send stays confirmed despite cache/refresh/thread-placement failures; ambiguous transport remains delivery-unconfirmed rather than prompting blind resend or provider switching.
- Website inquiry/chat/unfinished-checkout Inbox views, counts and refresh sources were repaired. Channel/history is preserved, no fabricated conversation or duplicate lead is created, and partial coverage is visible. Unfinished leads retain their business stage until explicitly closed/converted.
- Onboarding delivery review binds the workspace and exact attempt, checks actual delivery evidence, and records resolution without sending another email. Support mailbox inbound/outbound and generated message delivery were verified in prior acceptance; this is not a new blanket assertion that every future notification channel is delivered.
- The owner’s fictional Preview client workspace was preserved from automated reseeding and given a narrowly guarded test-plan control. This changes fixture entitlement only, never real Stripe subscriptions or customer billing.

### OpenAI and Intelligence — implemented and verified for the scoped workflows

- OpenAI Responses API replaced Anthropic calls/fallback for website assistance, onboarding and dashboard Intelligence. Default pinned text model is gpt-5.4-mini-2026-03-17; this is distinct from voice GPT-Live.
- Proposal review shows current/proposed settings. Apply uses existing authenticated, revision-guarded handlers. Pro clients can manage permitted follow-ups or request admin review; unsupported billing, access, provider/transfer activation and cross-tenant actions are denied.
- Strict fields, current ownership/role/entitlement, expiration, single use and replay protection are enforced. The live action handoff bug that dropped cookie headers was fixed; errors do not silently replay a save. Key whitespace is trimmed and errors redact credentials.
- Real isolated GPT acceptance proved proposal alone made no mutation, Apply saved, replay was rejected and original greeting restored. Earlier missing-key/quota blockers were resolved and are historical only.
- Follow-up totals use canonical effective status across all stored calls, not the limited detailed sample; actual GPT totals were compared to the dashboard.

### Stripe, payment confirmation and onboarding — sandbox verified; customer launch deferred

- Native first-party billing retains Stripe-controlled payment inputs and safe display metadata only. Canonical Stripe reads and workspace ownership guard plans, proration, cancellation/reactivation, billing contact, invoices and SetupIntent payment-method updates.
- Actual sandbox acceptance exercised declines, authentication/3DS, canceled authentication, insufficient-funds recovery, same-order retries and setup-fee exact-once behavior. Payment Element save-default restrictions were fixed.
- Unpaid upgrades remain pending; the existing plan changes only after the paid result. Delayed/replayed events read canonical subscription state rather than rolling it backward. Initial setup fee is not repeated at renewal/plan change.
- Durable fulfillment separates a paid payment from account preparation; late checkout events cannot duplicate workspace/welcome side effects. Branded payment failure/recovery/plan/subscription messages are idempotent; uncertain email delivery is reconciled, not blindly resent.
- Confirmation now distinguishes payment received, account ready, processing, open/expired/missing order, private verification and temporary unavailability. Bounded polling, manual/online recovery and specific bank-failure explanations replaced vague retry warnings. A network failure cannot turn a confirmed payment into a failure.
- Ambiguous submissions check the original private order; return to payment only when the server confirms it is open. Recovery retains business fields, never card details or blanket agreement acceptance; terms require fresh review.
- Customer-facing signup, agreement, payment, confirmation, sign-in and billing states received premium visual/loading/empty/error refinements. Full paid-customer onboarding through activated customer phone service remains unaccepted.
- Live Stripe catalog/portal/webhook/email settings were inspected read-only, not changed. Existing finalized-invoice email overlap needs a release decision; historical “Stripe not configured” and “sandbox acceptance pending” are superseded. Tax registration/entity readiness is owner confirmation, not a broken runtime service.

### Voice and reliability after Stripe — real isolated provider work; acceptance boundaries remain

- Initial audit separated seeded/UI-only voice settings from real integration. Vapi is behind a provider-neutral adapter; saved GPT-Live speaker/reasoner configuration powers actual calls. Vercel serves secure tools/lifecycle APIs rather than streaming audio.
- Assistant configuration/read-back canonicalizes provider limits, voice/tool ordering and permissions. Current roles are rechecked rather than trusting cached admin sessions. Verified provider/call binding derives workspace identity; caller-controlled metadata/IDs cannot cross tenants.
- Caller-ID matching is not identity verification for private history. NANP numbers are normalized, withheld callers do not merge indiscriminately, existing contact/open-request matching avoids duplicates, and partial corrections preserve previously captured details.
- Wrong-number, spam and resolved routine questions do not fabricate leads/follow-ups; noncustomer dispositions are excluded from customer directories. Call notes, request associations, follow-ups, notifications and usage are canonical journal results, replay-safe.
- Provider state is verified before and after resume/routing changes, with revision/stale guards and truthful uncertainty. Controlled pause routing read-back passed; a fallback number being configured is not human-pickup acceptance. Holiday/date/duration settings survive edits; the temporary closed-hours test policy was restored.
- Fresh local business-hours context is submitted at call start, avoiding routine “I’ll check” narration. The agent must not invent appointment availability. Goodbye handling waits for an in-flight save, preserves follow-up questions and does not hang up on ordinary acknowledgements. Latest actual retest still failed owner quality review.
- Office background sound was disabled after static feedback; the owner reported minor residual static. This is subjective call feedback, not independent acoustic certification. Recording remains off; configurable disclosure support is not legal acceptance or proof every opening disclosure was delivered.
- An actual demo tool verification read timed out after approximately 8.45 seconds; safe bounded transient read retries replaced that path. Writes are not automatically retried on uncertainty, malformed/access/rate-limit results are not treated as transient, and tools do not claim an uncertain request was saved.
- Lifecycle checks cover timestamp freshness/future values, duration, canonical IDs, active workspace/revision and exact provider association. Delayed artifacts use bounded batches, a fair cursor and owned lease; two opportunistic background recovery attempts do not constitute a durable schedule.
- Actual internal/demo populated exports and aggregate retention inspections passed. Configuration round-trip and journal replay have in-memory handler evidence; managed restore/provider reconnection remain unverified.
- Observed voice cost report covers 14 inbound calls and approximately $2.53 in mixed-revision tests, excluding outbound legs; it is not production margin or savings proof. Export canonical connected seconds differ from rounded provider display totals. Check current credit balance before any new acceptance spend.

### Approvals, constraints and superseded work to preserve

- One explicit website-only public release was authorized and performed October 5. That authorization does not authorize promoting subsequent Preview work, merging PR #5 or opening commercial checkout.
- Temporary project-wide Vercel automation bypass was approved for sandbox webhook acceptance only, then callback URL restored and token revoked; disposable sandbox subscription termination was approved and completed. Temporary acceptance harness was removed.
- Persistent Preview Vapi access was approved for exactly isolated internal/demo assistants, with transient assistants disabled; matching authenticated callback access and branch-only public Preview reachability were approved. Application login/authorization and webhook authentication remain enforced. Older unrelated demo/provider resources were left alone.
- Owner approved controlled internal test microphone access and a TOTAL $8 Vapi acceptance limit, not an additional recurring budget or unrestricted outbound calling. Internal calls are bounded to ten minutes; demo to five. Quality retesting was explicitly postponed.
- Preview backup and recurring recovery scheduling approvals already exist; do not ask again for that defined scope. New destructive restore targets, policy-based deletion, customer activation and Production release still require their own authorization.
- System Health separates core operational checks, real blockers, launch-gated release setup, owner confirmations and optional services. It must not use a fixed historical “2 blockers” count after conditions change, or let sandbox acceptance hide an actual environment failure.
- Calendar booking, SMS, broad cross-channel CRM, multi-user roles, datastore migration, Gmail push/history and campaigns remain intentionally deferred. No generic transcript showcase, extra ROI calculator or visible mobile image-control toolbar should be reintroduced without a new product decision.
- Preserve truthful distinction between real isolated calls, sandbox billing, seeded marketing/UI fixtures and customer Production. Do not mark physical-device, legal, complete telephone-matrix or managed restore acceptance complete from unit/browser tests.

Evidence anchors: tests/industry-experience.test.js, tests/cookie-preferences.test.js, tests/admin-action-confirmation.test.js, tests/admin-access-repair-atomic.test.js, tests/gmail-account-cache-isolation.test.js, tests/gmail-connection-concurrency.test.js, tests/gmail-provider-response-validation.test.js, tests/gmail-safeguards.test.js, tests/intelligence-actions.test.js, tests/client-intelligence-followups.test.js, tests/checkout-confirmation-experience.test.js, tests/native-checkout.test.js, tests/voice-integration.test.js, tests/voice-call-context.test.js, tests/voice-recovery.test.js, tests/voice-export.test.js, tests/voice-retention.test.js; detailed provider evidence remains in the acceptance/runbook documents cited above.

## HISTORY RECONCILIATION STATUS

- The full accessible local Work conversation archive was scanned from October 3 through this October 8 request: 50,792 archived records at extraction, including 136 user messages, 963 assistant messages and 83 completion summaries. Material instructions, approvals, accomplishments and autonomous-run closeouts were reviewed together with available attached continuation briefs and current implementation/tests.
- CALLERCORE_PROJECT_STATE.md was reconciled against that accessible history, repository sources, current draft PR, deployment metadata and retained acceptance reports. Missing current work was added; superseded transcript/cookie/Stripe/backup claims were consolidated. The earlier authorized Production website release is explicitly distinguished from subsequent Preview-only work.
- Full conversations in other chats and any work preceding the earliest available archive were NOT accessible. Their supplied handoffs are context, not independently reviewed original conversations. This is not a claim that every raw tool payload, historical screenshot or remote acceptance was independently rerun.
- Historical claimed test counts are not aggregated or promoted to current acceptance. Current hosted evidence is pinned in section 5; preserved local maintenance edits are not hosted-verified. Subjective telephone quality, physical-device behavior, legal readiness, managed restore and the complete actual-call matrix remain unverified as stated.
- This document can now serve as the canonical Work-to-ChatGPT synchronization document for the full accessible history and current verified scope. Future implementations must update it with evidence; the reconciliation does not remove launch gates or certify unavailable history.

## October 8 continuation checkpoint

- Published preserved recovery credential patch at 155c037a1d124d9c0e57bfefdcefaa9a251af409, then fixed authenticated JSON false/0 bypass at bdc31fa7919d1399c3211a6574c3fa3b648945a5. Empty-body validation now rejects scalar/array/nonempty bodies and selectors. Full local suite: 1,855 passed, zero failures/skips; 84 focused recovery/auth/runner/lease/idempotency tests passed (simulated).
- Fully accepted code runtime bdc31fa: READY Preview dpl_AC9C9XNe7T6MMbWsYAZQi6ScKAHr, https://my-ai-website-ovasbv5o8-mohamtaj004bas-projects.vercel.app. CallerCore CI push 37748269554 / PR 37748277094 passed; CodeQL push 37748269693 / PR 37748277137 passed, zero SARIF findings (job 113214933596); Jekyll 37748277483 passed.
- Authenticated Browser QA 37748269718 / job 113215177633 passed and exact deployment/SHA pin verified. Inspected artifact 11537233742: 279 layouts, 188 readability, 494 screenshot checks, 483 PNGs; zero console/page/API/visual failures; six visual comparisons all non-severe. Voice fixtures are seeded: realCalls:false/providerActivated:false. Artifact SHA256 a2072c42c1f60fe92633cac14cee863d5be45bcceeab99ea86a2bfcad633eb7b. Earlier QA 37747357804 was cancelled and is not acceptance.
- TJ saved an equivalent maintenance-only credential rotation. Vercel metadata confirms sensitive feature-branch Preview scope; callback credential metadata unchanged. Redeployed the same bdc31fa code to load it: READY dpl_DzkJFSCoWoTaruXGnnhM2JuNzPSe, https://my-ai-website-nzpn2qauk-mohamtaj004bas-projects.vercel.app; stable branch alias verified attached. Full Browser QA above belongs to the earlier immutable deployment; rotated credential positive auth remains unverified.
- Created QStash schedule scd_6X9ZUHpNFLW8NHZ7K1CrYsWcMhdU at October 8 01:30:04 Pacific: exact stable maintenance endpoint, POST, empty body, */5 cron, zero retries, 60000ms timeout. Paused before the first 01:35 scheduled delivery after browser inspection exposed the user-entered credential in a tool result. Do not commit or repeat its value. Owner must replace only the maintenance credential in both Vercel and QStash before resuming. No callback/webhook/tool auth weakened and no project-wide QStash credential injected.
- Request Builder send attempts produced no retained delivery log evidence; do not infer positive authentication, scheduled success or duplicate protection. Stable application GET 405 and missing/invalid POST 401 remain verified. Hosted malformed-body/webhook separation, recurring delivery IDs and before/after mutation comparison remain incomplete.
- Fresh private signed-in exports validated: internal 14 calls/14 journals/14 usage entries/1,484 seconds/3 contacts/5 leads, zero pending; demo 1 call/1 journal/1 usage/177 seconds/1 contact/1 lead, zero pending. These are before-delivery baselines, not hosted replay proof. Provider connection read-back passed for both isolated existing workspaces; no settings/routing or new phone calls performed.
- Daily Backup enabled with one-day retention; manual baseline complete at 7.49 MB. First automatic daily execution remains unobserved. Disposable restore procedure prepared in docs/PREVIEW_RECOVERY_ACCEPTANCE.md; no target created, restore executed or restored integrations activated. Exact disposable target and destructive step still require TJ authorization.
- Production rechecked READY and unchanged at dpl_4d13ERbPnK5gW4cBJjFMDUHNW1wY / 6d36aa454241588140a3d9945eed1a5696a65db6. PR #5 draft/unmerged; main unchanged. All commercial/customer telephony/public demo/recording gates remain closed.

## CURRENT HANDOFF FOR CHATGPT

- Work only in mohamtaj004ba/my-ai-website feature/callercore-dashboards. PR #5 remains draft/unmerged; Production intentionally trails Preview.
- Latest fully accepted code runtime bdc31fa7919d1399c3211a6574c3fa3b648945a5: 1,855 tests and CI/CodeQL/Jekyll/authenticated Browser QA passed, exact runs above. Same-code rotated-env redeployment dpl_DzkJFSCoWoTaruXGnnhM2JuNzPSe READY. Obtain subsequent documentation checkpoint SHA from Git.
- Recovery schedule installed but PAUSED, ID scd_6X9ZUHpNFLW8NHZ7K1CrYsWcMhdU. Credential was exposed in a browser tool result; TJ must replace the maintenance-only value in branch Preview and the schedule, then redeploy Preview. This is credential remediation, not a new scheduler approval request. Callback secret unchanged.
- Then resume schedule, prove positive/negative hosted auth and two recurring deliveries, and compare private canonical calls/journals/usage/CRM/follow-ups/notification identities. Local lease/idempotency tests are simulated, not hosted evidence.
- Daily backups enabled, managed baseline complete; first automatic execution unobserved. Restore procedure prepared; exact separate disposable target and erasure require TJ authorization. Never target active Preview/Production or activate restored provider/notification integrations.
- Preserve accepted billing, voice, CRM, exports and UX. Actual isolated PSTN calls exist; Stripe sandbox complete. Phone quality/transfer, physical devices, legal/disclosure, customer activation and public demo remain separate gates. No Production release authorized.