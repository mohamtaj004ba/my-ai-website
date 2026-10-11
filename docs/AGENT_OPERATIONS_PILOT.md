# One-task Agent Operations pilot proposal

Status: NOT APPROVED / NOT EXECUTED. This document and passing mock tests do not authorize spending. No existing voice allowance applies.

## Exact scope

One read-only task: inspect the Legal dashboard example for industry relevance and the Growth pricing card for badge/text overlap. Capture `/industries/legal` and `/#pricing` on the SAME pinned immutable Preview at 1440×1000 and 390×1000, four PNGs per inspection/review. The homepage contains pricing; there is no `/pricing` page. Scroll to `.legal-proof .proof-figure` and `#pricing article.featured`; fail closed if absent or if the response is unsuccessful.

Proposed target: accepted application source `8133597ff2fc5b48e3de42336e9e06fa4191c2a8`, immutable origin `https://my-ai-website-lh7loz3s5-mohamtaj004bas-projects.vercel.app`. Reverify the deployment-to-SHA mapping before approval/launch. The new operations runtime can be newer while its inspected website remains this explicit fixed target. Scope hash is computed from `{origin,commit,paths:["/industries/legal","/#pricing"]}` and must match the server approval manifest and task.

Verified October 11: deployment `dpl_C9my58Cfk9Dv1m3gter1GcnaRqmK` remains READY at that exact URL/SHA. Exact scope hash: `02601501cd10466210bf3501af4a8320229cb0fb52e447338535de8935390cdf`. Recheck before launch; this verification grants no approval.

No fixes, pushes, source edits, customer/admin browser cookies, third-party browsing, Production requests, telephony, Stripe or hosted OpenAI tools. Findings include observed screenshot evidence and a proposed correction in text. Independent review may reject; absence of a reproduced defect is an honest outcome, not permission to fabricate one.

## Calls and model

Supported Responses API, fixed model `gpt-4.1-2025-04-14`, no reasoning-effort parameter (a non-reasoning model), no built-in or arbitrary tools, `store:false`, JSON output and 1,500 maximum output tokens per response. This deliberately bounded first transport is not an installed Agents SDK or an API for controlling Work chats.

Normal path: four calls — Chief of Staff delegates → Website Visual QA inspects → independent QA examines fresh captures → Chief of Staff reports. A rejected result allows one reinspection/review before reporting: at most six calls, two inspection attempts and ten minutes total. Individual stage timeout is 90 seconds; lease is 30 seconds with monitored heartbeats. Errors/incomplete responses/uncertain writes block rather than automatically retrying paid requests.

Expected API usage: four responses, eight locally captured screenshots total, four low-detail images in each visual call, no images in the manager calls. Planning estimate: approximately 12,000 total input tokens and 2,400 output tokens, about $0.044 at the pricing below; actual usage may differ. Budget conservatively for up to $0.15 on the normal path. Per-call text input is limited to 10,000 UTF-8 bytes; image count, dimensions and byte size are bounded; no conversation history grows unbounded.

[Official model documentation](https://developers.openai.com/api/docs/models/gpt-4.1) lists Responses, image input and the pinned snapshot, with standard prices of $2/M input and $8/M output tokens. [Image documentation](https://developers.openai.com/api/docs/guides/images-vision) describes low-detail image input. Pricing version in code: `2026-10-11-gpt41-standard`; recheck before setting the short-lived approval. Project allowlist and credential model-metadata access were verified October 11 (HTTP 200); no inference was executed. Responses execution remains unverified until an explicitly authorized pilot; never substitute models automatically.

## Requested ceiling

Proposed maximum authorization: **$2 USD total for ONE task**, no purchases/autoreload or recurrence. Task, UTC daily and UTC monthly agent budgets are each $2. Every stage atomically reserves $0.30 before any model/tool call. Six calls reserve at most $1.80. Reservations are never returned to the available budget, even when actual usage is lower or the task is cancelled; uncertain attempts retain their full ceiling. Actual token cost is recorded separately and revalidated by the broker. This pessimistic policy prevents cancellation/retry from replenishing the allowance.

The transport accepts only recorded usage ≤100,000 input and ≤1,500 output tokens per call, costing at most $0.212 at the pinned rates, below its $0.30 reservation. Input bounds/low-detail images prevent legitimate requests approaching the conservative 100,000 limit. Any unexpected usage or model/pricing discrepancy blocks further work. This application limit is not a provider invoice-level hard cap; provider-side budget controls and pricing must be checked before execution. No new paid hosting is proposed: run one bounded worker on the existing owner-controlled machine, independently of chat.

## Approval and launch gates

Do not set these gates until TJ explicitly approves this pilot and its target/cost. The admin UI cannot approve or start paid execution.

1. Deploy/reconcile the operations code to feature Preview; verify CI, real disposable Redis, CodeQL and exact hosted checks. Keep PR #5 draft/unmerged. Confirm the inspected Preview/SHA above.
2. Enable the mock broker only with branch-Preview `CALLERCORE_AGENTOPS_ENABLED=true`, the pinned `CALLERCORE_AGENTOPS_PREVIEW_ORIGIN` and `CALLERCORE_AGENTOPS_COMMIT`, and a new random, scoped `CALLERCORE_AGENTOPS_WORKER_SECRET`. This grants only task-state operations, never repository/billing/provider writes. Existing sensitive Redis credentials stay server-side. No permission is silently inferred from this proposal.
3. After explicit paid authorization, set server `CALLERCORE_AGENTOPS_PAID_ENABLED=true` and a trusted `CALLERCORE_AGENTOPS_PILOT_APPROVAL` JSON manifest: `authorized:true`, unique `pilot_...` id, exact scopeHash, short expiry, `maxMicros:2000000`, pinned `model`, exact `pricingVersion`, `projectId:"proj_yXcOqJDtCRl2chdkRYAJ6VvH"`, `organizationId:"org-0Q2ER0RtAeROLY3fYSuMn5CX"`. Initialization consumes this approval ID once; repeat delivery returns the same task. No user-provided task objective or approval object is accepted for paid initialization.
4. In the bounded external worker, set mode `pilot`, its separate local paid gate, broker origin/worker secret, new dedicated `CALLERCORE_AGENTOPS_OPENAI_API_KEY` credential plus its matching `CALLERCORE_AGENTOPS_OPENAI_PROJECT_ID` and `CALLERCORE_AGENTOPS_OPENAI_ORGANIZATION_ID` and Preview protection bypass. Never print/store secrets in the repository. Sensitive Vercel credentials are not retrievable through the current connector; arrange approved secure injection into the worker if they are not already available. The browser process inherits only an OS environment allowlist, not provider/database credentials.
5. Run `scripts/agent-operations-worker.cjs` once, optionally hidden as an independent process. No recurring automation is created. It reads current approval before capture and before each model request; cancellation/revocation/timeout aborts execution and preserves reservations. Remove the paid gates after the one task regardless of outcome. A blocked task cannot consume a second approval automatically.

For an emergency stop, cancel the persisted task through the admin control center and stop the worker; this changes shared durable state visible to its pinned deployment. Do not rely on changing Vercel environment variables alone to revoke an older immutable deployment, which retains its deployment-time environment. Then disable paid gates for future deployments. Approval expiry must be an integer Unix timestamp in milliseconds; malformed/string/nonfinite expiry fails closed. Use a short expiry for the approved launch.

## Acceptance evidence

- Durable task/execution IDs, pinned commit/origin, chronological events and four distinct role-stage receipts.
- Real screenshot files and SHA256 hashes; no placeholders or synthetic finding accepted as pilot evidence.
- Specialist findings and proposed corrections are grounded in screenshots; independent QA uses fresh captures and a distinct execution ID, records accept/reject, and ties its decision to the inspected evidence hash.
- Chief of Staff reports the independent decision and actual scope. Verified inspection is distinct from integrated code, owner visual acceptance and release.
- Exact token counts/cost, reservation ledger, elapsed time and any unknown outcome retained. No repeated paid calls after cancellation, exhausted budget, timeout, unexpected output or provider error.
- Admin state reflects the same persisted task after reload/worker exit. Preserve existing client functionality and prove no Production/main/provider/billing changes.

If the pilot finds no reproducible defect, reports insufficient screenshot detail, or is rejected, report that outcome. A second paid task, higher-resolution expansion, model escalation, fixes or repository write permissions requires separate scope/authorization.

## Dedicated project preparation — October 11

- Platform project CallerCore Agent Operations, Personal organization. Project ID and organization ID are fixed in lib/agent-operations-project.js. No Default-project or existing CallerCore Preview credential was changed or read.
- Verified advisory monthly budget $5, alerts 50%/80%/100%, project spend $0.00. Dashboard explicitly says limit not enforced. CallerCore task/day/month limits remain $2; six pessimistic $0.30 reservations never replenish on cancellation or failure.
- Restricted project model allowlist to gpt-4.1-2025-04-14; future models blocked. New key CallerCore Agent Operations Pilot expires November 10, 2026. Saved endpoint permissions: List models Read; Responses Write; other endpoint families None. No paid request made. Read-only model metadata GET returned 200 before restriction; saved permissions and allowlist re-read in dashboard afterward.
- Credential is in the approved private-agent-operations/.env.agent-operations.local directory OUTSIDE the Git checkout. Parent ACL inheritance disabled, only current Windows user FullControl with child inheritance. Final file ACL checked after atomic save. Private parent contains a wildcard .gitignore; repository also ignores .env.agent-operations.local. No secret value in tool stdout, repository, CI artifacts or logs. Local private credentials are not included in the repository-scoped deployment/qa-artifacts upload. This protects normal workflows; no file system policy can prevent the authorized Windows user deliberately copying a secret elsewhere.
- Dedicated worker credential has no generic OPENAI_API_KEY fallback. Wrong/missing project identity fails before task initialization; paid approvals/tasks/reservations/receipts carry matching project/org. Fixed provider endpoint rejects redirects. Browser processes, including the local mock harness, inherit only OS allowlisted environment variables.
- Independent source review found no remaining application-level pilot blocker after isolation fixes. Independent QA is separate execution with fresh evidence, under one trusted worker scheduling identity; separate infrastructure identities are not claimed.
- Latest local verification: 1,913 full tests and 22 focused tests pass. Local real UI/API/SQLite mock browser harness also passes queue, delegation, independent review, cancellation, escaping and disabled gate at 1440/768/390/320, zero API inference calls/page errors. Repository content scan checked568 tracked/unignored files and found no credential content. Paid gates remain false; no approval manifest, recurring worker or inference launched. Before launch, secure broker/Preview bypass injection and exact runtime and target read-back remain required; never reuse the existing Preview API key.

Operational blocker verified October11: both exact inspected Preview and current runtime return302 Vercel-authentication redirects without credentials. Local process has no Preview protection or worker credential; local Vercel CLI auth absent. GitHub holds the existing protection credential but does not permit secret read-back. Secure local Preview-protection injection and new worker/broker configuration must be completed and read-only/mock capture verified before requesting paid approval. No key reuse, protection weakening or plaintext chat transfer. The model credential alone does not satisfy this gate. Project usage dashboard confirms zero tokens/requests; billing read-back confirms auto reload OFF.

Post-restriction zero-inference permission proof: pinned model metadata GET 200 succeeds; Files GET401 explicitly reports insufficient permissions/missing scopes. Only status/boolean evidence retained, no provider response content or secret logged. This verifies endpoint denial in addition to dashboard read-back.
