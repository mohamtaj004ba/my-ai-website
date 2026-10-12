# Durable Preview organization checkpoint

## Current authority

The owner authorized a $15 cumulative internal development allowance. Existing task ceilings are unchanged. The shared Redis CAS document admits all legacy and organization paid reservations atomically, including settled ceilings and historical uncertainty. Mock shadow reservations have a separate $15 ceiling and cost zero; they do not reduce paid headroom. No reservation is silently refunded. Platform budget alerts are not an enforced cap and were not changed.

The new registry issues durable **mock-only** owner grants: coordinate, inspect-and-test and engineering-preview. Role/tool permissions derive from the level. A coordinate grant cannot create an inspection workflow. Owner identity comes from the authenticated internal administrator session, matching membership and authoritative workspace owner record, never a request-body boolean. Grant issuance/revocation and task cancellation use revisions and owner binding. Agents cannot issue grants, raise budgets, change policy or activate writes. Grants expire, impose workflow/concurrency quotas and bind the exact protected source. Engineering grants currently allow only virtual rollback rehearsal; no repository/Git/deployment write route exists. Permission, budget, QA, consequence and scope escalations are durable records that block the task. Only its verified issuing owner can record a decline or requirement for separate authorization; a decision cannot revive the task or expand its grant.

## Workflow and models

`organization-evidence-first-v1`: Chief → visual specialist → blind observation → claim adjudication → independent acceptance → Chief report. Five maximum model invocations. Chief and visual reviewer use Sol Medium. The visual specialist also uses Sol Medium because this assignment requires visual accuracy. GPT-4.1 remains an explicit routine-coordination/comparison option in model policy and immutable legacy profiles; it is never an automatic paid fallback.

Every stage has a fresh bounded context. Blind observation receives four images and their binding, without specialist findings, Chief transcript, gold labels or previous verdicts. Observations must persist and seal before claim disclosure. Claim atoms require same-image observations and intersecting evidence regions; known suitability, security, narrative and blanket no-correction conclusions require insufficient-evidence rejection. This guard is not universal semantic entailment proof. Independent direct image assessment remains authoritative. Geometry conflicts, structural validation, integrity, substantive accuracy and final acceptance are separately recorded. Chief output is a report and cannot change these outcomes.

Parent capture authority, worker capability and independent acceptance capability are separate random credentials stored as hashes. None is included in model requests. Mock stages run in separate restricted Node processes with no provider/broker/Vercel credentials, outside-Git file access, writes or subprocess permissions. Native model requests are built from fresh stage projections. The trusted parent holds project credentials and protected transport identity; browser/model inputs receive neither. No external model tools are available except strict Chief function proposals consumed by the backend state machine.

## Persistence and failures

All new records occupy `operations` within the existing atomic ledger. Legacy tasks/reservations remain unchanged. Creation is idempotent and never reissues lost capabilities. Dependencies require verified, independently accepted predecessor work. Global concurrency is two; grant concurrency is one or two. Lease is 30 seconds with fenced revisions and ten-second heartbeats. Total workflow deadline is ten minutes. Each model stage is at most 150 seconds, including stage preparation/capture. Independent acceptance is bounded by the remaining deadline and at most 60 seconds, with cancellation signalling.

One reservation and one dispatch per stage. Paid work has no retry/recovery replay. A lost process with a pending reservation is blocked and retains uncertainty. Only an unreserved mock stage may be explicitly recovered once. Late/cancelled/revoked completions cannot resurrect a task. Recovery can terminalize an expired task. Preparation failures, provider failures and interrupted acceptance persist separately; cancelled/blocked work never remains accepted even if an earlier acceptance record is preserved.

Provider diagnostics retain sanitized wording/code/parameter/request and response identifiers, timing, status, service tier, token/cache/reasoning usage, incomplete reason, refusal and output hash where available. No raw prompt, image, key or provider body is logged. Paid settlement independently matches completed default-tier/no-cache diagnostics to the receipt. An anomalous or unconfirmed response retains its ceiling and prevents subsequent calls. Returned usage is token-derived application evidence, not invoice reconciliation.

## Evidence and rollback

New captures use the fixed 8133597 Legal/Growth source and four 1440/390 × 1000 screenshots. The parent binds PNG bytes/dimensions/hashes to the reserved execution; timestamps must fall between reservation and registration. Capture capability registers evidence once; worker results must match. Original historical evidence is never overwritten.

Optional fixed-selector pricing geometry is collected immediately before the screenshot in the same browser session, with three stable font-loaded samples. Raw rectangles and samples persist with the hash; backend recomputes badge/heading/price relations. Reproduction-only geometry is labelled separately. Bounding-box intersection is not proof of painted glyph occlusion or industry suitability.

The durable change journal rehearses prepare → owner-attested fixture QA → virtual apply → rollback, with revisions, content hashes and preserved history. It operates only on `fixture/*.txt` virtual values. Rollback remains available after grant revocation, while new apply is denied. **This does not activate real file edits, engineering commits or prove independent QA of real code changes.** A separately authorized engineering executor and artifact-bound test/QA integration are still required for operational write autonomy.

## Admin integration and remaining gates

Existing admin UI is preserved. Broker monitoring now returns real grants, workflow stages/dependencies, leases, calls, reservations, chained audit and separate outcomes. Owner mutations are separate from restricted worker/verification commands. New paid initialization requires an exact temporary organization approval, project/model/schema/pricing identity and access/estimate acknowledgements. No approval or paid flag is enabled by this implementation.

Offline/mock acceptance and hosted Preview verification establish infrastructure behavior, not new model accuracy. Next live proposal is separate. Broader organization knowledge ingestion, scheduling and real engineering writes remain future permission-controlled capabilities. The proposed read-only workflow does not activate them.
