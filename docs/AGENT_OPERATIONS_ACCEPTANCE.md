# Agent Operations Phase 1 verification

Scope: bounded Preview infrastructure, mock execution and a disabled one-task paid adapter. Passing these checks does not establish real-agent website acceptance or authorize spending.

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
