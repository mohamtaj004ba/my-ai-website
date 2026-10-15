# Phase C.5: useful correction preparation

## Verified defect and coherent proposal

Both Overview and Analytics daily charts in `dashboard.js` use the local start of a day plus 86,400,000 milliseconds as its end. Local calendar days can last 23 or 25 hours. Independent inspection of the actual two loops reproduced spring double counting and fall omission using fictional timestamps; no customer records were used.

The exact curated source SHA256 is `441484e8a28273bb17eb0c1533b306935c30e00526a5cfc68a8e75b011fad5a6`. On the Los Angeles spring transition, expected daily totals `[2,3,0]` become `[4,3,0]` in both charts. On the fall transition, expected `[4,1,0]` become `[3,1,0]`. The previous single-chart profile did not cover Analytics. Its original records are retained unchanged.

New profile `dashboard-local-days-v2` proposes three text edits: insert one shared `nextLocalDayStart(date)` helper using calendar `setDate`, and use it for both chart boundaries. Preserve the rolling-duration `withinDays` filter, other KPIs, and tomorrow-button semantics. The proposal's expected final source hash is `927a6f08f768f24fe1deb29d52226d2c13f69fb4b8a8a00cf0f96f6f0730a88f`. The authoritative dashboard remains unchanged.

Regression evidence separates actual-source reproduction from proposed behavior: source anchors and complete three-edit structure are checked as data; independently authored trusted calendar reference checks Los Angeles, Auckland, half-hour Lord Howe transitions, UTC year/leap boundaries, Kolkata, and exclusive midnight endpoints. Proposed JavaScript is never evaluated. This is not a demonstration of the patched UI or safe arbitrary generated-code execution.

Local evidence: `artifacts/agent-operations/CALENDAR_DAILY_CHART_INDEPENDENT_QA.json`, `C5_BOTH_CHARTS_INERT_ARTIFACT.json`, `C5_BOTH_CHARTS_REVIEW.patch`, and `C5_TARGETED_FINAL.log`. The artifact uses explicitly fictional offline authority; it is not a hosted grant or owner approval. It records genuine restricted-child preparation, verified source/patch identity, completed workspace destruction, and publication disabled.

## Operational extension and boundaries

The existing authenticated correction preset now selects both charts. It uses the existing five-stage journal and before/after fenced authority checks. No competing task, credential or budget system is added. A restricted trusted child accepts at most three unique ordered replacements within one allowlisted curated file. Exact owner/workspace/task/execution/fence/source/deployment/release bindings and preimage hashes are validated. A canceled, expired, stale or revoked task cannot publish a draft receipt; the existing final CAS remains authoritative.

This permits useful proposed text artifacts rather than a fixed comment demonstration. It still does not provide arbitrary file access, a shell, execution of proposed source, network tools, GitHub writes, deployments or autonomous publication. Heap/output/time bounds do not constitute a complete OS sandbox. Parent-process crash orphan cleanup and untrusted-code execution require separately verified isolation.

Two proposals, immutable unresolved independent-review decisions and an accurate Chief report are preserved. Successful preparation does not imply semantic acceptance. Human reviewer independence remains unavailable under the current policy, and no specialist or Chief can approve its own work.

## Browser preparation and spending decision

See `c5-browser-image-approval.md`, pinned manifest, recipe and fixed qualifier. These are preparation only. No build, image pull/import/storage, sixth proof session, purchase or new recurring workload is authorized. Exact image digest and total builder/registry/transfer/account quote must be resolved before a spending request. One five-minute 2-vCPU/4-GB iad1 compute estimate is $0.0284006, excluding image build/import/storage/transfer and other account charges. It is not a billing cap.

The old receipt proved asset transfer, but stopped at the loader check with 20 unresolved entries. Chromium never launched. A future fixed local fixture qualification must prove native dependencies, non-root execution, actual launch, valid PNG and geometry, deadline/cancellation and independent stopped-state cleanup. Protected Preview identity and allowlisted egress require a separate service-bound verification; Work browser sessions cannot be borrowed.

## Real reasoning and proactive work: next authorization boundary

The current engineering sequence uses deterministic reasoning and real bounded tools. The existing real-model worker is the separately verified Legal/Growth inspection workflow; it is not an engineering inference adapter. No real AI investigation or semantic code review is claimed here.

A future narrowly scoped trial should bind one exact engineering assignment, source, tool evidence, proposed patch and independent review to the existing controller and Redis ledger. Explicit stages are Chief delegation, specialist investigation/proposal, independent review and Chief consolidation. Responses strict JSON schemas, image access, Medium reasoning, per-stage limits, reservation accounting and cancellation must be adapted and verified before owner activation. Model text cannot grant tool or publication authority. A fresh model/pricing/preflight and explicit budget authorization are required; the existing $4.40 internal remainder is not permission to spend it.

For future proactive intake, require separate categories: reproducible defect, design preference, accessibility observation, and unproven conversion hypothesis. Each needs exact permitted page/viewport/source evidence, scope, uncertainty and deduplication before routing. Messaging, trust, navigation and calls to action are visitor-perspective considerations, not automatically verified defects. No recurring scan, background inference or new worker is enabled.

## Remaining integration dependencies

Preserve genuine historical repository-scoped GitHub and project-scoped Vercel reads and the existing Gmail Inbox with four verified sender identities. Calendar/Drive/Contacts preparation remains inactive pending owner consent/resource confirmation and verified refresh/gateway wiring; Docs/Sheets content adapters remain absent. The revoked Stripe sandbox credential is not reusable; privately provision the previously documented Accounts plus five resource read permissions, all writes None, before new verification. No broad live billing key may be substituted.

Existing four departments, Engineering Auditor, recovery foundations and later premium command-center plans are unchanged. Paid model execution, internal publication and Production access remain disabled.
