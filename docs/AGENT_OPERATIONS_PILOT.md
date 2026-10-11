# One-task Agent Operations pilot proposal

Status: NOT APPROVED / NOT EXECUTED. This document and passing mock tests do not authorize spending. No existing voice allowance applies.

## Exact scope

One read-only task: inspect the Legal dashboard example for industry relevance and the Growth pricing card for badge/text overlap. Capture `/industries/legal` and `/#pricing` on the SAME pinned immutable Preview at 1440×1000 and 390×1000, four PNGs per inspection/review. The homepage contains pricing; there is no `/pricing` page. Scroll to `.legal-proof .proof-figure` and `#pricing article.featured`; fail closed if absent or if the response is unsuccessful.

Proposed target: accepted application source `8133597ff2fc5b48e3de42336e9e06fa4191c2a8`, immutable origin `https://my-ai-website-lh7loz3s5-mohamtaj004bas-projects.vercel.app`. Reverify the deployment-to-SHA mapping before approval/launch. The new operations runtime can be newer while its inspected website remains this explicit fixed target. Scope hash is computed from `{origin,commit,paths:["/industries/legal","/#pricing"]}` and must match the server approval manifest and task.

No fixes, pushes, source edits, customer/admin browser cookies, third-party browsing, Production requests, telephony, Stripe or hosted OpenAI tools. Findings include observed screenshot evidence and a proposed correction in text. Independent review may reject; absence of a reproduced defect is an honest outcome, not permission to fabricate one.

## Calls and model

Supported Responses API, fixed model `gpt-4.1-2025-04-14`, no reasoning-effort parameter (a non-reasoning model), no built-in or arbitrary tools, `store:false`, JSON output and 1,500 maximum output tokens per response. This deliberately bounded first transport is not an installed Agents SDK or an API for controlling Work chats.

Normal path: four calls — Chief of Staff delegates → Website Visual QA inspects → independent QA examines fresh captures → Chief of Staff reports. A rejected result allows one reinspection/review before reporting: at most six calls, two inspection attempts and ten minutes total. Individual stage timeout is 90 seconds; lease is 30 seconds with monitored heartbeats. Errors/incomplete responses/uncertain writes block rather than automatically retrying paid requests.

Expected API usage: four responses, eight locally captured screenshots total, four low-detail images in each visual call, no images in the manager calls. Planning estimate: approximately 12,000 total input tokens and 2,400 output tokens, about $0.044 at the pricing below; actual usage may differ. Budget conservatively for up to $0.15 on the normal path. Per-call text input is limited to 10,000 UTF-8 bytes; image count, dimensions and byte size are bounded; no conversation history grows unbounded.

[Official model documentation](https://developers.openai.com/api/docs/models/gpt-4.1) lists Responses, image input and the pinned snapshot, with standard prices of $2/M input and $8/M output tokens. [Image documentation](https://developers.openai.com/api/docs/guides/images-vision) describes low-detail image input. Pricing version in code: `2026-10-11-gpt41-standard`; recheck before setting the short-lived approval. Account entitlement is not yet verified and may cause a blocked pilot, never an automatic model substitution.

## Requested ceiling

Proposed maximum authorization: **$2 USD total for ONE task**, no purchases/autoreload or recurrence. Task, UTC daily and UTC monthly agent budgets are each $2. Every stage atomically reserves $0.30 before any model/tool call. Six calls reserve at most $1.80. Reservations are never returned to the available budget, even when actual usage is lower or the task is cancelled; uncertain attempts retain their full ceiling. Actual token cost is recorded separately and revalidated by the broker. This pessimistic policy prevents cancellation/retry from replenishing the allowance.

The transport accepts only recorded usage ≤100,000 input and ≤1,500 output tokens per call, costing at most $0.212 at the pinned rates, below its $0.30 reservation. Input bounds/low-detail images prevent legitimate requests approaching the conservative 100,000 limit. Any unexpected usage or model/pricing discrepancy blocks further work. This application limit is not a provider invoice-level hard cap; provider-side budget controls and pricing must be checked before execution. No new paid hosting is proposed: run one bounded worker on the existing owner-controlled machine, independently of chat.

## Approval and launch gates

Do not set these gates until TJ explicitly approves this pilot and its target/cost. The admin UI cannot approve or start paid execution.

1. Deploy/reconcile the operations code to feature Preview; verify CI, real disposable Redis, CodeQL and exact hosted checks. Keep PR #5 draft/unmerged. Confirm the inspected Preview/SHA above.
2. Enable the mock broker only with branch-Preview `CALLERCORE_AGENTOPS_ENABLED=true`, the pinned `CALLERCORE_AGENTOPS_PREVIEW_ORIGIN` and `CALLERCORE_AGENTOPS_COMMIT`, and a new random, scoped `CALLERCORE_AGENTOPS_WORKER_SECRET`. This grants only task-state operations, never repository/billing/provider writes. Existing sensitive Redis credentials stay server-side. No permission is silently inferred from this proposal.
3. After explicit paid authorization, set server `CALLERCORE_AGENTOPS_PAID_ENABLED=true` and a trusted `CALLERCORE_AGENTOPS_PILOT_APPROVAL` JSON manifest: `authorized:true`, unique `pilot_...` id, exact scopeHash, short expiry, `maxMicros:2000000`, pinned `model`, exact `pricingVersion`. Initialization consumes this approval ID once; repeat delivery returns the same task. No user-provided task objective or approval object is accepted for paid initialization.
4. In the bounded external worker, set mode `pilot`, its separate local paid gate, broker origin/worker secret, existing scoped OpenAI API credential and Preview protection bypass. Never print/store secrets in the repository. Sensitive Vercel credentials are not retrievable through the current connector; arrange approved secure injection into the worker if they are not already available. The browser process inherits only an OS environment allowlist, not provider/database credentials.
5. Run `scripts/agent-operations-worker.cjs` once, optionally hidden as an independent process. No recurring automation is created. It reads current approval before capture and before each model request; cancellation/revocation/timeout aborts execution and preserves reservations. Remove the paid gates after the one task regardless of outcome. A blocked task cannot consume a second approval automatically.

## Acceptance evidence

- Durable task/execution IDs, pinned commit/origin, chronological events and four distinct role-stage receipts.
- Real screenshot files and SHA256 hashes; no placeholders or synthetic finding accepted as pilot evidence.
- Specialist findings and proposed corrections are grounded in screenshots; independent QA uses fresh captures and a distinct execution ID, records accept/reject, and ties its decision to the inspected evidence hash.
- Chief of Staff reports the independent decision and actual scope. Verified inspection is distinct from integrated code, owner visual acceptance and release.
- Exact token counts/cost, reservation ledger, elapsed time and any unknown outcome retained. No repeated paid calls after cancellation, exhausted budget, timeout, unexpected output or provider error.
- Admin state reflects the same persisted task after reload/worker exit. Preserve existing client functionality and prove no Production/main/provider/billing changes.

If the pilot finds no reproducible defect, reports insufficient screenshot detail, or is rejected, report that outcome. A second paid task, higher-resolution expansion, model escalation, fixes or repository write permissions requires separate scope/authorization.
