# CallerCore project state

Updated: 2026-09-25. Resume here, then inspect current Git refs and deployments. This record distinguishes inspected code, automated verification, and provider-complete acceptance. Never treat a historical checklist as current deployment evidence.

## Project and architecture

CallerCore is an AI front office for service businesses, with a public acquisition site, managed onboarding, client workspace, and owner/admin operations dashboard.

- Repository: `mohamtaj004ba/my-ai-website`.
- Development: `feature/callercore-dashboards`; production: `main`.
- Static HTML/CSS/JavaScript, not Next.js. `dashboard.html`, `admin-dashboard.html`, `dashboard.js`, `dashboard.css` supply the dashboards.
- Vercel Functions under `api/`, shared modules under `lib/`; primary account dispatcher is `api/account.js`.
- Upstash Redis via `@upstash/redis`; Preview isolation implemented in `lib/kv.js`.
- Stripe billing, Mailgun lifecycle email, admin-only Gmail OAuth, Anthropic-assisted onboarding are present. Provider-complete launch verification remains separate.
- Voice/Vapi is a dedicated unfinished workstream. Do not imply live telephony from seeded dashboard data.

## Verified starting checkpoint

Read-only inspection on 2026-09-25 confirmed:

- Development SHA: `fa6039e38384169aac88becabe1ac5ffc61888b9` — Exercise polished Follow-ups actions in Preview QA.
- Main SHA: `37ef5cfcdccae35952822859f64fe83f0b9f09f0`.
- Development 977 commits ahead, 0 behind main; fresh local checkout clean.
- No newer changes on the designated development branch relative to the handoff. Other sessions' unpushed workspaces were not available for inspection.
- PR [#5](https://github.com/mohamtaj004ba/my-ai-website/pull/5) remains open and draft. Its body references an older checkpoint and is not the current QA record.
- Preview `dpl_2Z5hciVB3Wtm9PJSXhZLjcjxFjRA` is READY at this SHA: https://my-ai-website-lv1hnqccv-mohamtaj004bas-projects.vercel.app
- CallerCore CI, CodeQL, Jekyll: success on this SHA.
- Authenticated Preview QA run `36103929249`: completed/success on this SHA (queried through GitHub Actions API).

## COMPLETED AND VERIFIED

At the starting checkpoint, recent Calls, Contacts, and Follow-ups passes exist in code and the exact-head CI/Preview QA above passed. This verifies covered workflows, not every product claim or external integration.

Current local Conversations changes: 163/163 tests pass, including executable renderer regressions with 125 threads, filter reset, message-based recency, empty-result status cleanup, exact Active matching, and malformed message-array handling.

## IMPLEMENTED BUT NOT FULLY VERIFIED

- Existing customer areas: Overview, Calls, Contacts, Conversations, Follow-ups/Leads, AI Receptionist, routing, locations, automations, analytics, integrations, billing, settings, support. Entitlements and runtime flags determine visibility.
- Existing admin areas include client operations, calls, agents, Gmail/website inbox, prospects, analytics, revenue/usage, provisioning, phone numbers, support, health, platform settings.
- Existing auth/tenant isolation, session revocation, read-only admin client view, agreements, export/redaction, audit and recovery safeguards have regression coverage. Full security assurance is not established by automated tests alone.
- First Conversations scaling pass: 50-thread batches, counts, activity sorting, Closed filter, clear filters, accessible selected states, bounded responsive list, long-message wrapping, stale empty-result cleanup. Authenticated Preview QA pending for this new commit.

## IN PROGRESS

Conversations at scale. Extend existing interface, not a replacement. Existing Preview QA was expanded to exercise batching, sorting, empty state, reset and contact navigation.

Next sequence: finish Preview verification, then inspect AI Receptionist saved/edit states, then Settings/forms. Preserve existing architecture, safeguards, styling direction, and plan entitlements.

## Known limitations and remaining work

- Conversations currently reads a tenant-scoped KV array via `requireFeature(...,'unifiedInbox')`; full data still transfers to the client. Rendering batches are not server pagination.
- Client Conversations is a history viewer. No client reply composer or shared unread state was found. Do not invent working messaging or change SMS launch scope to expose it.
- Conversation records link to derived contact history; admin Gmail/website Inbox is a separate data source. A shared client/admin message-delivery pipeline has not been verified.
- Thread rendering remains unbounded within an individual message history; further high-volume thread work may be needed.
- Some release docs predate implementation: README's unlimited Pro statement corrected; environment matrix/DEPLOY contain historical isolation and QA notes; production readiness still describes the already-replaced `@vercel/kv` client. Use actual code and current evidence.
- Older rollback deployment references are historical and differ from current main SHA. Re-verify the appropriate production rollback target before an authorized release.

## NOT STARTED / dedicated remaining work

Within this continuation session: AI Receptionist and Settings focused review have not started.

Roadmap: production voice lifecycle; provider-complete disposable onboarding; Stripe test-mode subscription/payment/recovery scenarios; provider restore drill; logging/privacy and release review. Check actual implementation before marking any historical roadmap item not started.

## BLOCKED

Commercial release remains blocked on dedicated provider validation and owner decisions. Routine Preview dashboard development is not blocked.

## OWNER DECISION REQUIRED

Legal entity/business registration and Washington tax treatment; minute overage and Pro fair-use policy; SMS/calendar scope and provider readiness; final legal review; final production release and checkout activation. See `docs/TJ_DECISION_BACKLOG.md` for details, reconciling older completed items first.

## Product decisions to preserve

- Premium, understandable operational UI; explicit Edit/Save/Cancel states; meaningful loading/empty/error states; mobile and keyboard usability.
- Call type, AI disposition, and team status are separate. Capturing a request does not mean the business completed it.
- AI dispositions: Resolved by AI, Request captured, Message taken, Transferred, Escalated, Incomplete, Non-customer call.
- Team statuses: No action needed, Needs action, In progress, Completed, Dismissed.
- Growth/Pro unified Conversations access; do not rewrite plan permissions.
- No fabricated metrics, fake green health, or implied operational providers.
- SMS/calendar remain gated until dedicated readiness/approval. Gmail remains admin-only.
- Preserve signed agreements, accepted commercial terms, and approved retention periods.

## Production restrictions

Only commit/push routine changes to the authorized development branch. No merge into main, production deployment, DNS/routing changes, production record mutations, live checkout/billing, live customer numbers, destructive tests, or customer-facing communications without explicit approval. Never disable protections for QA or expose secrets.

## Verification and continuity workflow

- `npm ci --ignore-scripts`; `npm test` (Node regression tests); build also runs tests.
- `.github/workflows/callercore-ci.yml`, `codeql.yml`, `jekyll-docker.yml`.
- `.github/workflows/preview-browser-qa.yml` automatically runs on feature pushes, waits for Vercel, exercises disposable authenticated client/admin workflows, captures responsive screenshots/errors, uploads reports.
- `scripts/preview-browser-qa.mjs`; `scripts/visual-diff.mjs`.
- QA secrets stay in GitHub Actions. Do not copy their values into docs/chat.
- At each meaningful checkpoint record source SHA, deployment, tests actually run/results, limitations and next task. A documentation-only follow-up may reference the last verified implementation SHA rather than claim self-verification.

## Supporting documents

`README.md`, `DEPLOY.md`, `docs/FINAL_PRELAUNCH_AUDIT.md`, `docs/PRODUCTION_READINESS.md`, `docs/TJ_DECISION_BACKLOG.md`, `docs/DATA_RETENTION_POLICY.md`, `docs/BACKUP_AND_RECOVERY.md`, `docs/DATA_RECOVERY.md`, `docs/INCIDENT_RESPONSE.md`, `docs/ENVIRONMENT_SCOPE_MATRIX.md`, `docs/ANALYTICS_ROLLUP_DESIGN.md`, `docs/VOICE_UNIT_ECONOMICS.md`.
