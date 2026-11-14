# Durable temporary approval lifecycle

This Preview-only correction follows the blocked4867cb6 pilot. No paid approval, hosted activation, live model request or new write authority is authorized during implementation.

## Root cause and detection gap

Environment approval JSON on an immutable deployment previously conferred authority before Redis held a task or grant. Replacing environment settings/deploying a disabled replacement did not change that binary. Initialization issued a grant and then created a task in separate commits. Terminal-task cleanup tests missed the window before either object existed. The preserved offline counterfactual demonstrated original paid=true / replacement paid=false with no provider transport.

## Authoritative lifecycle

The environment is configuration, not authorization. `durable-approval-v1` records live inside the same Redis CAS document as task state, grants, reservations and audits. Unknown, malformed, unavailable, prepared, revoked, expired, wrong-deployment or stale-release records cannot admit execution. No default permission or environment fallback exists.

| State | Authority | Transition |
| --- | --- | --- |
| Absent | None | Verified CallerCore workspace owner prepares one configured approval |
| Prepared | None | Owner activates exact new deployment after verification |
| Active | One initialization only, valid owner lease required | Atomic task/grant creation consumes approval |
| Consumed | Only that task on that deployment | Every consequential boundary rechecks registry |
| Revoked | None, irreversible | Owner or dedicated revoke-only capability; terminal/cancellation also retires |
| Expired lease/approval | None | Cannot renew or reactivate; revoke remains callable |

Approval identity includes owner hash, preselected unique workflow ID, exact source SHA and release fingerprint, scope/project/model/reasoning/schema/pricing, five calls,20koutput/call,150sstage,10mintotal,$3.60holds/$15cumulative, fixed expiration. Entire approval hash is durable. Activation binds immutable platform origin plus source SHA. Task initialization creates its grant/task and consumes authorization in ONE CAS. Workflow IDs cannot reuse reserved or historical IDs. Idempotent replay cannot create another task.

The platform supplies deployment origin/source at the broker; caller/model does not choose it. Prepare/activate/renew require the authenticated CallerCore workspace owner with same-origin POST. A Vercel team owner is not substituted for workspace ownership. The trusted parent may retain a random revoke-only capability returned by prepare; storage keeps only its digest. The worker endpoint requires its existing broker authentication AND this dedicated capability for revocation, never for activation/renewal. Worker/model DTOs receive none of this owner authority. Public summaries omit capability digests and owner hashes. Revocation is independent of configured approval presence, paid flag, expiration and release, so a replacement can shut down an old upgraded deployment. An owner-selected ID can be tombstoned before prepare, defeating delayed/lost registration responses.

Revocation cancels nonterminal matching tasks, revokes grants and zeros leases atomically; final historical results and all uncertain reservations remain unchanged. Normal writes in both legacy and organization stores cap at990kbytes. Emergency revocation allows1.01MB, covering bounded preexisting1MB ledgers and tombstones; no eviction or evidence deletion. Lifecycle events are separately bounded by32records and irreversible transitions, unaffected by the normal600event audit capacity. Already-revoked retries do not advance ledger revision.

All paid legacy standalone initializer/worker routes are retired in the actual runtime handler, which always supplies the organization. Historical standalone records remain readable. Standalone unit harnesses without the runtime organization remain compatibility tests, not a production execution route.

## Interruption, renewal and transport boundary

`withActivation` is a trusted-owner callback controller, with no default transport, credentials or executor. Prepare/deploy/activate/run must use verified authenticated Preview endpoints. Persist the owner-selected approval ID BEFORE any request. `finally` revokes by ID even if prepare/activation responses are lost, then requires both exact broker readbacks false; shutdown errors are surfaced. Phases share an abort signal and <=10minute deadline; renewal failure aborts execution. Cleanup has its own15second bound. No retry or recurrence is implemented.

Owner renewal occurs every10seconds and maintains a30second central lease, never extends approval expiration, budget, permissions or task deadline. Worker heartbeat cannot renew owner authority. A hard-killed controller cannot execute finally: authority expires within the30second lease, rather than surviving until10minute approval expiration. This bounded crash window is explicit, not an instantaneous shutdown guarantee. Store unavailability denies admission/status, never supplies cached authority; shutdown cannot be reported confirmed until storage/readbacks recover.

Lease-only owner renewal advances a Chief's expected transport ledger revision ONLY if its binding already matches current state and belongs to that approval. It does not change the immutable request/context binding, catch up a stale Chief, or conceal unrelated task/budget/grant changes. Independent QA regression reproduced the former renewal-induced failure and verifies the correction.

The Redis dispatch CAS is the admission linearization point. Revocation committed first denies dispatch. A request already admitted/transmitted cannot be retracted or guaranteed unbilled by revocation. Provider heartbeat abort is best effort; revoked completion is denied and its uncertain reservation remains pending. No new dispatch/acceptance is permitted after committed revocation. Concurrency tests cover both orderings.

## Legacy deployment qualification

Immutable pre-lifecycle binaries cannot be patched by deploying a replacement. Their historical approvals must be expired/consumed and disabled before any future activation. New approvals require lifecycleVersion/workflowId/sourceCommit and organization-contracts-v3; activation on an old binary is prohibited. Existing historical brokers remain checked paid=false. Cross-deployment central revocation is implemented for upgraded instances sharing the ledger, not falsely claimed for old code that never reads the registry.

## Verification and operational readiness

Mandatory contract preflight includes lifecycle/independent Auditor tests, request-faithful five-stage native mocks, frozen revision/observation/reporting failure replays and semantic completeness gates. Disposable Redis CI adds concurrent activation, exact deployment isolation, one-task consumption, central revoke and pending-hold preservation. Full regressions, CI, CodeQL and protected hosted/browser QA must pass on the published SHA.

Implementation tests use synthetic approvals and mocked model transport ONLY. No hosted paid approval is created for verification. Hosted disabled checks prove actual source/fingerprint/lifecycle version, Redis readability, permission denial, unchanged accounting and history. They do not prove a real owner prepare/activate/renew transaction or provider completion. The old outside-Git live controller must not be reused: it lacks durable preparation, owner renewal and revocation. Any future bounded pilot must use the verified new controller path, prove authenticated owner control and both-broker cleanup first, and obtain fresh source-bound owner authorization. No automatic later execution is authorized by this correction.

Future organization, trusted reviewer attestations, monitoring, mobile loaded-data readiness and autonomous engineering executors remain separate capabilities. No paid retry, recovery executor or new write permission is enabled here.
