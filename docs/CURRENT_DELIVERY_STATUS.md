# CallerCore current delivery status

Updated: 2026-10-06

This is the current status entry point. Older September planning documents retain historical context; their unfinished Stripe and voice-integration lists do not describe the current Preview implementation.

## Release boundary

Development remains on `feature/callercore-dashboards`; PR #5 remains draft and unmerged. Public Production intentionally serves an older stable release. Preview improvements do not authorize production checkout, customer telephony, automatic overage charges, tax registrations, or a Production promotion.

## Completed implementation and evidence

- Stripe sandbox acceptance is complete; preserve its verified behavior.
- Preview has provider-backed voice configuration, secure workspace-scoped tools, canonical call processing, CRM updates, usage accounting, and isolated internal/demo infrastructure.
- Delayed call details have bounded webhook-triggered recovery and an authenticated Preview maintenance endpoint. This is not a connected recurring scheduler.
- Public demo readiness requires explicit acceptance evidence and verified isolated resources. An unavailable demo presents a clear fallback instead of a generic retry message.
- Runtime commit `50fb7b9a34d15fa8d665c1f8aeb5328b7ad16d10` passed 1,822 local tests, CI run 37548184415 and CodeQL run 37548184391 with zero findings. Its targeted hosted demo check passed. Do not infer the latest full browser sweep result from these checks.
- Previous runtime `101f593ae7452ece46e4de231026b64c687dd6d1` completed full Browser QA run 37546198360: 279 layout, 188 readability and 490 screenshot checks, with 479 PNGs. This evidence is specific to that runtime.

## Work that does not need TJ to participate

- Application recovery tests, authorization and concurrency checks.
- Customer-flow and responsive browser review using isolated Preview fixtures.
- Documentation reconciliation, failure-state wording and regression fixes.
- Voice-aware export validation and recovery coverage without activating restored provider resources (implemented in this follow-up).
- Scheduler design and tests; connecting it must preserve existing credential scope and the Preview release boundary.

## Recovery findings and limits

Workspace exports now include a versioned voice section containing configuration, contacts, canonical calls, per-call journals, pending recovery, usage ledger and follow-up state. Source identities, accounting links and concurrent changes are validated before download. Older exports containing phone views without canonical voice records are not reported as complete recovery sources. Export contents do not automatically reconnect or activate a provider.

The `admin-recovery-drill` endpoint checks export structure; it does not restore a database. The new stateful configuration round-trip test exercises the real override and audit-restore handlers with an in-memory transaction double. It verifies routing derivatives, tenant isolation, unchanged workspace billing linkage, audit entries and refusal of stale restore requests. It does not prove Redis backup restoration or provider reconnection.

Managed database backup/PITR availability and a full database restore drill still need verification. Never automatically activate provider resources from an imported snapshot. Existing secrets are not included in exports.

## Deferred or gated work

- Phone sound, conversational quality and real human-transfer retesting remain deferred at TJ's request.
- A complete paid-customer-to-activated-phone acceptance journey remains distinct from separate sandbox billing and isolated voice acceptance; customer telephony is still gated.
- Physical-device checks require actual devices; browser emulation is separate evidence.
- Pricing, supplier spending, legal/recording policy and Production activation require owner decisions.
- Optional SMS and calendar booking remain disabled; they are not completed features or mandatory blockers for the currently defined service.

See `VOICE_PREVIEW_RUNBOOK.md` for voice procedures and `CALLERCORE_PROJECT_STATE.md` for chronological evidence.
