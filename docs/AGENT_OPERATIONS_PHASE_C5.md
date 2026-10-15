# Phase C.5: useful correction preparation

## Verified defect and coherent proposal

Both Overview and Analytics daily charts in `dashboard.js` use the local start of a day plus 86,400,000 milliseconds as its end. Local calendar days can last 23 or 25 hours. Independent inspection of the actual two loops reproduced spring double counting and fall omission using fictional timestamps; no customer records were used.

The exact curated source SHA256 is `441484e8a28273bb17eb0c1533b306935c30e00526a5cfc68a8e75b011fad5a6`. On the Los Angeles spring transition, expected daily totals `[2,3,0]` become `[4,3,0]` in both charts. On the fall transition, expected `[4,1,0]` become `[3,1,0]`. The previous single-chart profile did not cover Analytics. Its original records are retained unchanged.

Published profile `dashboard-local-days-v2` and its original static proof are preserved. Independent QA later found a material limitation: copying a midnight-transition start and advancing its date preserves 01:00; the existing start calculation can also carry that hour into earlier dates. Santiago 2026-09-06 and Sao Paulo 2018-11-04 reproduce this using trusted fictional timestamps. The earlier artifact is superseded, not silently replaced.

Latest profile `dashboard-local-days-v3` proposes three text edits: insert one shared `localDayBoundary(date, offset)` calendar constructor, capture one reference date per chart, and derive BOTH start and end independently from that reference. It covers Overview and Analytics together. Preserve the rolling-duration `withinDays` filter, other KPIs, and tomorrow-button semantics. Expected final source hash: `d0e084ec5a3926f0c306c65a1e94f15ff2d93af286023fdf7821b564018e9466`. The authoritative dashboard remains unchanged. Entirely skipped civil dates may produce an empty bucket with a repeated normalized label; no complete timezone-history UI solution is claimed.

Regression evidence separates actual-source reproduction from proposed behavior: source anchors and complete three-edit structure are checked as data; independently authored trusted calendar reference checks Los Angeles, Auckland, half-hour Lord Howe transitions, UTC year/leap boundaries, Kolkata, and exclusive midnight endpoints. Proposed JavaScript is never evaluated. This is not a demonstration of the patched UI or safe arbitrary generated-code execution.

Local evidence: `artifacts/agent-operations/CALENDAR_DAILY_CHART_INDEPENDENT_QA.json`, `C5_CALENDAR_V3_INERT_ARTIFACT.json`, `C5_CALENDAR_V3_REVIEW.patch`, and `C5_MIDNIGHT_COMPOSITION.log`. The artifact uses explicitly fictional offline authority; it is not a hosted grant or owner approval. It records genuine restricted-child preparation, verified source/patch identity, completed workspace destruction, and publication disabled.

## Operational extension and boundaries

The existing authenticated correction preset now selects both charts. It uses the existing five-stage journal and before/after fenced authority checks. No competing task, credential or budget system is added. A restricted trusted child accepts at most three unique ordered replacements within one allowlisted curated file. Exact owner/workspace/task/execution/fence/source/deployment/release bindings and preimage hashes are validated. A canceled, expired, stale or revoked task cannot publish a draft receipt; the existing final CAS remains authoritative.

This permits useful proposed text artifacts rather than a fixed comment demonstration. It still does not provide arbitrary file access, a shell, execution of proposed source, network tools, GitHub writes, deployments or autonomous publication. Heap/output/time bounds do not constitute a complete OS sandbox. Parent-process crash orphan cleanup and untrusted-code execution require separately verified isolation.

Two proposals, immutable unresolved independent-review decisions and an accurate Chief report are preserved. Successful preparation does not imply semantic acceptance. Human reviewer independence remains unavailable under the current policy, and no specialist or Chief can approve its own work.

## Browser preparation and spending decision

See `c5-browser-image-approval.md`, pinned manifest, recipe and fixed qualifier. These are preparation only. No build, image pull/import/storage, sixth proof session, purchase or new recurring workload is authorized. The subsequent AGENT_OPERATIONS_C5_IMAGE_METADATA.md addendum verifies the exact public platform digest; total builder/registry/transfer/account quote must still be resolved before a spending request. One five-minute 2-vCPU/4-GB iad1 compute estimate is $0.0284006, excluding image build/import/storage/transfer and other account charges. It is not a billing cap.

The old receipt proved asset transfer, but stopped at the loader check with 20 unresolved entries. Chromium never launched. A future fixed local fixture qualification must prove native dependencies, non-root execution, actual launch, valid PNG and geometry, deadline/cancellation and independent stopped-state cleanup. Protected Preview identity and allowlisted egress require a separate service-bound verification; Work browser sessions cannot be borrowed.

## Real reasoning and proactive work: next authorization boundary

The current engineering sequence uses deterministic reasoning and real bounded tools. The existing real-model worker is the separately verified Legal/Growth inspection workflow; it is not an engineering inference adapter. No real AI investigation or semantic code review is claimed here.

A future narrowly scoped trial should bind one exact engineering assignment, source, tool evidence, proposed patch and independent review to the existing controller and Redis ledger. Explicit stages are Chief delegation, specialist investigation/proposal, independent review and Chief consolidation. Responses strict JSON schemas, image access, Medium reasoning, per-stage limits, reservation accounting and cancellation must be adapted and verified before owner activation. Model text cannot grant tool or publication authority. A fresh model/pricing/preflight and explicit budget authorization are required; the existing $4.40 internal remainder is not permission to spend it.

For future proactive intake, require separate categories: reproducible defect, design preference, accessibility observation, and unproven conversion hypothesis. Each needs exact permitted page/viewport/source evidence, scope, uncertainty and deduplication before routing. Messaging, trust, navigation and calls to action are visitor-perspective considerations, not automatically verified defects. No recurring scan, background inference or new worker is enabled.

## Remaining integration dependencies

Preserve genuine historical repository-scoped GitHub and project-scoped Vercel reads and the existing Gmail Inbox with four verified sender identities. Calendar/Drive/Contacts preparation remains inactive pending owner consent/resource confirmation and verified refresh/gateway wiring; Docs/Sheets content adapters remain absent. The revoked Stripe sandbox credential is not reusable; privately provision the previously documented Accounts plus five resource read permissions, all writes None, before new verification. No broad live billing key may be substituted.

Existing four departments, Engineering Auditor, recovery foundations and later premium command-center plans are unchanged. Paid model execution, internal publication and Production access remain disabled.

## Final hosted verification

Application2efd4a0, READYdpl_3fkbfthzT8LYv5tadTS4jsrQwPhG, release174faad877e614ca74a8b93b25080eeee14427a09586813cb7e4b3330bfb14f3. Actual owner assignment op_851bcb9ec41149d1b847e60edd75a074 completed all five stages once, with real deployed source/publicCI and actual restricted text child. Two QA decisions remain unresolved; Chief matches immutable review; acceptedWorkfalse, publicationfalse, allleases0, destroyedtrue, modelcalls/reservations0. Independent Work QA/Auditor validated rendered export and exact source/artifact bindings; this does not fabricate independent live-model/human semantic acceptance.

LocalSTRICT3038/3038 and remoteCI3038/3038/actualRedis17/17 passed; CodeQL/Jekyll/authenticatedBrowser passed. Browser artifact11951455365 matched its SHA256 and exact deployment pin, with545 real PNGs and an inspected Agent Operations screenshot. Report has no console/page/API/visual-contract failure. Six pixel comparison reference images were missing, so no pixel-drift claim is made. Original failure artifacts and superseded v2 proposal remain preserved. Source and Preview product behavior have not been changed by the proposed dashboard patch.

No new model or Sandbox resource was activated. Paid broker and accounting history remain unchanged; current owner snapshot shows no active assignment. See canonical project state for exact identities, qualified limits and the next owner decision.
