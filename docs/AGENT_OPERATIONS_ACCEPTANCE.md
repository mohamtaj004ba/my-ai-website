# Agent Operations Phase 1 verification

## Agent Operations broker and hosted mock verified — October 11

Status: technically ready for the bounded pilot, awaiting explicit human authorization. Paid execution remains false locally and on the hosted broker; no approval manifest or inference request exists. This checkpoint supersedes earlier pending broker/access statements below.

- Verified runtime source 9a1c70999ad19e44db50bc947bb2153855532b1e, READY Preview dpl_5Qcuy3m2vQvoVWp6KnnmhEuaS2Sd at https://my-ai-website-b37hdvesd-mohamtaj004bas-projects.vercel.app. Trusted parent pins both origin and SHA. Preserved cf56811, a3eea54 and 6f51165; fetched remote c5d82e2 with zero remote-only divergence before publication.
- Independent random worker/broker secret securely provisioned only to the authorized branch Preview and private local file outside Git. Existing OpenAI and Preview keys unchanged. File ACL permits only current Windows user; no credential value in repository, stdout or artifacts.
- Hosted happy task 8c5bc6d8-2f0d-4ef3-91ef-7ae988bad061 completed Chief of Staff, specialist, independent QA and report with four distinct execution IDs, matched evidence hashes, zero tokens and zero actual cost. Four pessimistic reservations total $1.20.
- Hosted cancellation task 77b840f2-71c3-4483-9b9f-4a0c08c52f1c cancelled during execution. Its $0.30 pending reservation remained charged to the allowance; stale revision/completion rejected409. Wrong credential401; foreign-task, paid, approval, release, arbitrary fixture/objective and unauthorized commands403. Idempotent delivery did not duplicate execution.
- Both actual worker children attested zero Vercel and broker credential variables, denied private credential-file access, enabled Node permission model, and denied child-process access. Mock children receive no OpenAI credential. Parent alone retains short-lived development OIDC and broker secret; IPC is scoped to one task and an exact command schema. Fixed-code defense in depth is verified, not an OS sandbox guarantee for hostile code.
- Temporary mock-verifier capability durably revoked; subsequent read/create denied403. All four temporary hosted variables and local copies removed. Old immutable deployment also observes durable revocation. Production has no Agent Operations variables.
- Local full suite: 1,925 passed, zero failures/skips; six worker-boundary tests passed. Independent review found no remaining material application safeguard issue, including the deliberate mode/local gate launch entrypoint. Published runtime CI, disposable Redis, CodeQL and Jekyll passed; Browser QA status is recorded separately when final.
- Protection read-back remains enabled/all_except_custom_domains. PR5 open/draft/unmerged. Production READY dpl_4d13ERbPnK5gW4cBJjFMDUHNW1wY / 6d36aa454241588140a3d9945eed1a5696a65db6 unchanged.
- Final proposal: docs/AGENT_OPERATIONS_PILOT.md. One read-only Legal/Growth task on fixed source8133597, four expected/six maximum calls, ten minutes, $2 total/task/day/month ceilings, no automatic paid retries or recurrence. Launch requires explicit authorization, one-use task-bound manifest, deliberate local/server paid gates, fresh development identity and a newly read-back pinned Preview runtime. Current paid-disabled runtime cannot launch a paid task.


Scope: bounded Preview infrastructure, mock execution and a disabled one-task paid adapter. Passing these checks does not establish real-agent website acceptance or authorize spending.

Authenticated capture acceptance, October11: local CLI owner sign-in verified; in-process same-project development identity passed local preflight and Vercel accepted exact Legal/home documents with200. Four font-correct PNGs and hashes in local ignored exec_preflight_d0ae681f-81a6-490e-b86b-6b5f2f510680 independently inspected. Licensed local fonts are hash-verified and fulfilled offline; both intended families must load. Five denied-scope requests with a real identity produced zero network requests; invalid/missing identities still302 to Vercel auth. Local1,919 tests pass, including six access tests. Protection remains enabled, PR5 draft/unmerged, Production unchanged and zero model calls. Capture access/rendering gate resolved; hosted broker credential/mock execution and explicit paid authorization remain. Earlier fallback-font capture is superseded, not normal-browser visual evidence.

Protected Preview follow-up, October11: 1,918 local tests pass, including five bounded-transport tests. Independent review found no material permissions/spending regression. Exact immutable target read-back is READY/8133597; both approved documents reject unauthenticated requests with Vercel302 redirects. Protection remains enabled. OIDC identity is retained only in trusted Node transport; browser receives no identity/cookies/provider headers. Explicit documents/static assets, expiry, cancellation, 256-request cap (request257 denied), resource size and redirect denial are covered with fixtures. Actual authenticated capture, its four screenshots, broker secret/configuration and hosted mock worker remain unverified external gates. No paid execution or release acceptance is claimed.

## Control evidence

| Control | Demonstrated behavior |
| --- | --- |
| Durability | Actual SQLite transactions survive reconnects and four separate worker processes. CI additionally executes the production storage adapter's Lua against disposable real Redis. |
| Delegation | Persisted chief → website specialist → separate reviewer → chief report, with distinct execution receipts and artifact-bound review. Model output cannot choose transitions or grant permissions. |
| Independent QA | Acceptance advances to reporting; rejection permits one bounded reinspection/review and terminates at six executions/two inspection attempts. Mock findings are explicitly synthetic. |
| Execution limits | Six executions, ten-minute task deadline, 90-second stage timeout, fenced 30-second leases, bounded audit/storage/input/output. Exhaustion fails closed. |
| Cancellation | Active adapter receives abort, persisted cancellation survives reload, and stale completion cannot resurrect the task. Unresolved reservation remains consumed. |
| Permissions | Current internal administrator required; disabled members, client roles, impersonation, cross-origin mutations and arbitrary actions denied. Worker credential cannot enqueue arbitrary tasks, cancel, approve, integrate or release. |
| Retry safety | Idempotency conflicts rejected; stale lease fenced; uncertain storage write attempted once; interrupted reserved execution blocks instead of replaying. No automatic paid request retries. |
| Spending | Atomic pre-execution $0.30 reservations, $2 task/day/month ceilings, no reservation refunds. Concurrent exhaustion and next-day monthly exhaustion denied. Exact fixed-model token accounting verified with fake Responses transport. |
| Paid approval | Separate server/local gates, exact scope/model/pricing/maximum/task binding, one-use approval ID and expiry. Disabled, revoked, mismatched, expired, malformed and nonfinite expiry produce zero provider requests. |
| UI safety | Persisted queue/monitor/cancel, escaped output, disabled gate and no overflow/page errors at 1440/768/390/320 in the local real UI/API/SQLite harness. Auth/models mocked and unrelated dashboard scripts removed. |

Focused evidence is in `tests/agent-operations-runtime.test.js`, `tests/agent-operations-policy.test.js`, and `tests/agent-operations-redis.integration.cjs`. Local suite: 1,912 passed, zero failed/cancelled/skipped. The canonical project handoff records exact published SHAs and hosted run/artifact evidence.

Accepted runtime: `4a49aeb0b5e11ac25ba3dc22551997f48ed2ddb5`. CI (including real Redis), CodeQL (zero SARIF findings), Jekyll and authenticated Browser QA `38129982286` pass. Downloaded artifact `11698952662` matches SHA256 `730fb8c41c3b9f9bcee24a4dcdf8350bc6cf1ea0612cdb14b5e1f1e1ac99172d`: 287 layouts, 196 readability checks, 502 screenshot checks, 551 PNGs, zero console/page/API/visual errors and six successful visual comparisons. The new view fits all eight hosted widths from 1536 to 320. Its persisted worker acceptance remains local/mock and disposable Redis CI; hosted acceptance is explicitly read-only disabled-state/UI verification. No live Client Intelligence/model pilot was exercised.

## Boundary and launch configuration

Agent Operations cloud execution flags and paid approval remain unset. Hosted disabled-state verification must not be described as a successful hosted worker run. Real Redis CI is disposable and has no application credentials. Local mock workflow acceptance is separate from a future real API pilot and owner visual acceptance.

The existing browser workflow's live Client Intelligence verification is disabled for this development phase. Interrupted earlier runs were cancelled in pre-client public/industry/customer checks; downloaded artifacts contained no client/admin phase evidence. No Agent Operations paid pilot ran.

Pilot proposal: `AGENT_OPERATIONS_PILOT.md`. Launch still requires explicit owner authorization, secure scoped credential injection, current account/model access and price checks, plus enabling the approved Preview broker/worker configuration. Cancellation must update the durable task and stop the worker; environment changes alone cannot revoke an older immutable deployment. No Production/main merge, billing, telephony, source-write tool or recurring execution is included.

## Dedicated project safeguards — October 11

Published runtime e565e7ac11f5bab5365445a0174dd8b68c30c26f binds paid approval, task, reservation, usage receipt and request headers to the dedicated CallerCore Agent Operations project/org. Generic Preview credential fallback is refused before initialization. Fixed provider requests reject redirects. Separate execution/fresh evidence QA remains under one trusted worker identity, not separate infrastructure identities.

Local full suite 1,913/1,913 and focused 22/22 pass; local real UI/API/SQLite mock harness passes 1440/768/390/320 with zero API inference calls/page errors after browser environment restriction. CI 38132338781 full job 114449069461 confirms 1,913 passes; real disposable Redis job 114449069376 confirms 1/1. CodeQL PR 38132341186/job 114449077495 reports zero total SARIF results. Jekyll 38132341182 and PR CI 38132341157 pass. READY deployment dpl_2n7nvNqsTERYbAq82mxpSvvDfs6m exact hosted API 503/no-store proves execution stays disabled.

Platform read-back: $5 advisory budget (not enforced), alerts 50/80/100, model allowlist only gpt-4.1-2025-04-14, key Restricted, expires November 10, Models Read, Responses Write, other families None. Metadata GET 200 and Files missing-permission 401 verify authentication/endpointdenial without inference. Project-filtered usage shows zero tokens and requests; available prepaid funding and automatic reload OFF verified. Independent source review confirms the bounded application controls; platform/ACL evidence verified by parent process.

Credential location outside Git with protected parent NTFS ACL, current user only access and verified file ownership; 568 repository and 31 local artifact files checked without finding credential content. Secret/private recipient key never committed/uploaded; temporary recipient key removed. Existing Preview key unchanged.

Operational launch blocker: exact target and runtime require Vercel authentication (unauthenticated 302); local protected Preview/worker credentials absent, no local Vercel CLI auth. GitHub secret read-back unavailable. Secure injection/new worker/broker configuration and read-only/mock hosted capture must be completed before asking for paid authorization. No paid approval requested/executed, no protection weakened. PR #5 draft/unmerged, Production unchanged.

Hosted Browser QA 38132338813/job 114449069605 passes on that exact Preview. Artifact 11700116158 downloaded and SHA256 verified f15bee20f5a13cd97a69cb9180b98977a0a3a74c862447f7e0d58c4332d7b085; report ok=true, 287 layouts, 196 readability checks, 502 screenshot checks, 551 PNGs, zero console/page/API/visual failures, six visual comparisons ok/non-severe. Agent Operations disabled/paidExecution=false/readOnlyCheck=true, eight widths 1536 through 320. Desktop/320px screenshots inspected. Live Intelligence false in workflow logs and absent in report. This is disabled-state/UI acceptance, not hosted worker execution or owner visual acceptance.
