# CallerCore current delivery status

Updated: 2026-10-06

This is the current status entry point. Older September planning documents retain historical context; their unfinished Stripe and voice-integration lists do not describe the current Preview implementation.

See [the actionable backlog](AUTONOMOUS_BACKLOG.md) for the current item-by-item inventory and [the maintenance runner contract](VOICE_MAINTENANCE_WORKER.md) for the prepared recurring recovery work. Retention inventory, on-page export downloads and corrected sandbox-readiness labels passed 1,852 local tests in the autonomous follow-up; hosted verification is recorded separately by exact runtime.

## Release boundary

Development remains on `feature/callercore-dashboards`; PR #5 remains draft and unmerged. Public Production intentionally serves an older stable release. Preview improvements do not authorize production checkout, customer telephony, automatic overage charges, tax registrations, or a Production promotion.

## Completed implementation and evidence

- Stripe sandbox acceptance is complete; preserve its verified behavior.
- Latest recovery safeguard runtime: `713058a48d3c56e7701a6e7ca82bbf4f9ceb7d6a`, immutable Preview https://my-ai-website-18rldj3nu-mohamtaj004bas-projects.vercel.app. All 1,835 local tests passed. CI run 37551649842 passed; CodeQL run 37551649887 passed with zero SARIF findings. Browser acceptance is recorded in the final checkpoint below.
- Preview has provider-backed voice configuration, secure workspace-scoped tools, canonical call processing, CRM updates, usage accounting, and isolated internal/demo infrastructure.
- Delayed call details have bounded webhook-triggered recovery and an authenticated Preview maintenance endpoint. This is not a connected recurring scheduler.
- Public demo readiness requires explicit acceptance evidence and verified isolated resources. An unavailable demo presents a clear fallback instead of a generic retry message.
- Voice recovery runtime `0e4ab7e0db746afb6a189a1543e10293662d098b` passed 1,832 local tests, CI run 37550173848 and CodeQL run 37550173819 with zero findings. Hosted admin export validation passed with all 15 sections present. Full Browser QA run 37550169989 passed for that runtime.
- Earlier runtime `101f593ae7452ece46e4de231026b64c687dd6d1` completed full Browser QA run 37546198360: 279 layout, 188 readability and 490 screenshot checks, with 479 PNGs. This evidence is specific to that runtime.

## Work that does not need TJ to participate

- Application recovery tests, authorization and concurrency checks.
- Customer-flow and responsive browser review using isolated Preview fixtures.
- Documentation reconciliation, failure-state wording and regression fixes.
- Voice-aware export validation and recovery coverage without activating restored provider resources (implemented in this follow-up).
- Scheduler design and tests; connecting it must preserve existing credential scope and the Preview release boundary.

## Recovery findings and limits

Workspace exports now include a versioned voice section containing configuration, contacts, canonical calls, per-call journals, pending recovery, usage ledger and follow-up state. Source identities, accounting links and concurrent changes are validated before download. Older exports containing phone views without canonical voice records are not reported as complete recovery sources. Export contents do not automatically reconnect or activate a provider.

The `admin-recovery-drill` endpoint checks export structure; it does not restore a database. The new stateful configuration round-trip test exercises the real override and audit-restore handlers with an in-memory transaction double. It verifies routing derivatives, tenant isolation, unchanged workspace billing linkage, audit entries and refusal of stale restore requests. It does not prove Redis backup restoration or provider reconnection.

Read-only inspection on October 6 confirmed that the isolated `callercore-preview-redis` database has Daily Backup disabled and no backups listed in its Upstash Backups tab. Its paid plan supports daily backups; no upgrade, retention change or restore was performed. Production backup state was not inspected. A managed backup and a restore into a separate disposable database remain unverified. Never automatically activate provider resources from an imported snapshot. Existing secrets are not included in exports.

## Deferred or gated work

- Phone sound, conversational quality and real human-transfer retesting remain deferred at TJ's request.
- A complete paid-customer-to-activated-phone acceptance journey remains distinct from separate sandbox billing and isolated voice acceptance; customer telephony is still gated.
- Physical-device checks require actual devices; browser emulation is separate evidence.
- Pricing, supplier spending, legal/recording policy and Production activation require owner decisions.
- Optional SMS and calendar booking remain disabled; they are not completed features or mandatory blockers for the currently defined service.

See `VOICE_PREVIEW_RUNBOOK.md` for voice procedures and `CALLERCORE_PROJECT_STATE.md` for chronological evidence.


Observed costs: see [the test-call sample](VOICE_OBSERVED_COSTS.md). No new paid calls were placed for that review.

Voice retention: the legacy permanent-purge path now refuses voice-bearing workspaces before deleting additional data. Complete voice-aware cleanup/provider detachment remains readiness work; it has not been performed or represented as complete.

### Final recovery safeguard verification — October 6, 2026

- Verified runtime: 713058a48d3c56e7701a6e7ca82bbf4f9ceb7d6a. Immutable Preview: https://my-ai-website-18rldj3nu-mohamtaj004bas-projects.vercel.app. Stable branch alias: https://my-ai-website-git-feature-caller-d75cb2-mohamtaj004bas-projects.vercel.app.
- All 1,835 local tests passed. CallerCore CI 37551649842 passed. CodeQL 37551649887 passed with zero SARIF findings. Full authenticated Browser QA 37551645588 passed on this exact runtime: 279 layout, 188 readability and 490 screenshot checks, 479 PNGs, zero console/page/API/visual failures. Artifact 11452884702 was downloaded and its report inspected.
- Hosted admin export validation reported 15/15 sections and explicitly stated no database restore was performed. Once automated QA finished, the normal Download export control successfully downloaded a sample-workspace export; its voice section passed the actual validator. That fixture contained zero canonical calls. A real internal-call workspace download was not independently captured; populated canonical voice bundles are covered by the handler/unit recovery tests, not by that empty fixture.
- Read-only Upstash inspection confirmed the isolated Preview database has Daily Backup off and no saved backups. Its paid plan supports daily backups without a Prod Pack purchase. No backup setting, subscription, restore, Production resource or provider activation was changed. Managed backup retention approval and a restore into a separate disposable target remain open.
- Permanent deletion remains fail-closed for voice-bearing workspaces pending verified provider detachment and voice-aware retention cleanup. Configuration round-trip and export checks do not claim a managed database restore or legal retention approval.
- Observed cost evidence is a small mixed-revision test sample only. No new calls or credit purchases. Phone quality and human-transfer retesting remain deferred; recurring Preview maintenance is prepared but unconnected.
- Production is still READY on 6d36aa454241588140a3d9945eed1a5696a65db6. PR #5 remains draft/unmerged; checkout, taxes, automatic overages, recording and customer telephony remain gated. This final checkpoint changes documentation only; runtime acceptance above is tied to the specified SHA.



### Autonomous backlog closeout — October 6, 2026

- Verified runtime: de290558a7c3685018e2e63a72f33bbdf1c0b7a6. Immutable Preview: https://my-ai-website-q64uywptu-mohamtaj004bas-projects.vercel.app. Stable branch alias: https://my-ai-website-git-feature-caller-d75cb2-mohamtaj004bas-projects.vercel.app.
- All 1,852 local tests passed. CallerCore CI 37554473722 passed. CodeQL 37554473654 passed with zero SARIF findings. Full authenticated Browser QA 37554469549 passed on this runtime: 279 layout checks, 188 readability checks, 494 screenshot checks, 483 PNGs and zero console/page/API/visual failures. Artifact 11454378158 was downloaded and its report inspected. Voice report/error/workspace-switch states passed at 1440, 768, 390 and 320 pixels; these fixtures do not assert new real-call acceptance.
- Actual signed-in administrator checks verified the read-only retention report and normal recovery download for both existing isolated workspaces. Internal: 14 canonical calls, 14 journals, 14 usage entries, 3 contacts, 5 leads, zero pending details and 1,484 connected seconds. Demo: 1 canonical call, 1 journal, 1 usage entry, 1 contact, 1 lead, zero pending details and 177 connected seconds. Both downloads passed the actual voice export validator and require separate provider reconciliation before any restore. Raw downloads remain private local files and were not committed. SHA-256: internal 52b7330a7ef61f10c4a3a8cc57b6cdeff19bf773fa38a326a0313ac82c219e18; demo b49dac3f3692761990118294d3c3aaf5878bcb78624e27fdcb64118cebfdd8a2.
- Both retention reviews found zero old-content, old-recording, old-metadata, unknown-date or active-call candidates. Changing workspace cleared the previous report. No records were changed or deleted. Screenshots document the new report; actual downloads remained on the operations page with inline success feedback.
- Actual System Health now distinguishes completed sandbox billing acceptance from closed Production checkout and owner launch gates. Stored settings are not reported as live phone acceptance.
- The recurring maintenance runner is tested and ready, but no schedule or new secret destination was installed. Existing callback-secret authorization is restricted to branch Preview. Managed backups, disposable-database restore, destructive/provider cleanup, legal/recording decisions and customer activation still require their specified approvals. Phone sound/ending/human-transfer retests remain deferred at TJ's request; physical-device checks require actual devices.
- Current actionable Preview engineering work is complete; conditional post-launch product work is separately identified in AUTONOMOUS_BACKLOG.md and is not claimed complete. No new paid calls or provider mutations were made during this closeout. Production remains READY on 6d36aa454241588140a3d9945eed1a5696a65db6; PR #5 remains draft/unmerged. Runtime evidence above belongs to de290558; this closeout checkpoint is documentation only.
