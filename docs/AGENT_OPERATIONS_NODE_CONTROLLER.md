# Tracked Node owner controller and restricted worker

Status: non-billable implementation verification in progress. Paid execution remains disabled. Historical standalone organization-v2-live-control.cjs is retired unconditionally; its exact original bytes are preserved outside Git under SHA256 c69742ad6a0b0fa9bbbc5feb0c02c9d5613c9198ec292b1c55fb120b51d41e94. Never patch its obsolete source/accounting constants and reuse it.

## Risk analysis and actual boundaries

The former helper never called the durable owner lifecycle and mistook Vercel team ownership for CallerCore workspace ownership. Existing BrowserWorker and callback unit tests did not exercise that executable. This is the central High readiness gap AO04, not evidence the hardened backend admitted unauthorized paid work.

Trusted current workspace-owner session -> same-origin protected Preview API -> Node supervisor -> shared Redis registry. The local restricted worker receives no owner session/renewal authority. It initializes once through the existing worker API, receives existing task-bound capabilities, captures approved images and runs the existing five-stage runApproved path. The supervisor waits for the same exact approved workflow and monitors it; it never receives worker/capture/assessor tokens. No new operational role or credential is granted. API route activation requires the existing separately configured paid approval parser, current owner hash, exact release/task/scope/budget/expiry and paid=true. Development uses only server-fixed authorized=false/zero-call/zero-budget probe records.

## Implementation

agent-operations-node-controller.execute is the shared actual Node orchestration. It snapshots bindings before prepare, validates actual receipt IDs, full approval digest, source/origin/release/expiry, checks positive authority before initialization/run, renews10seconds with bounded10second renewal, and always centrally revokes then independently reads the exact record. It does not fabricate replacement verification: requiresIndependentReplacementReadback remains true.

organizationPort binds a verified owner and reauthorization callback to existing prepare/activate/renew/initialize/revoke/summary methods. runPilot composes these ports with the actual request-construction/provider runner. supervisePilot uses the same execute/core but waits at most30seconds for the restricted worker to consume/create the exact task. It polls real task state, stops expired running leases or stalled progress (30seconds; independent acceptance60seconds), and reports only the backend terminal projection.

Successful/rejected terminal workflows automatically revoke approvals. The controller accepts that only with exact approved workflow/approvalHash/release/call count, completed execution, structural/integrity outcomes, and matching immutable results/outcomes/revision. A cancelled, incomplete, invented or altered terminal response cannot pass. A fast worker may finish before the supervisor sees initialization; exact terminal-before-observation handling prevents duplicate execution or a false failure. Renewal racing terminal retirement is classified by the same authoritative terminal checks; no permission is restored.

remote-worker initializes at most once, setting its attempt guard before any request. Unknown/lost responses stop without retry. It pins exact immutable runtime and release/active approval before initialization, uses task-bound API methods and the existing runner, merges cancellation with15second transport deadlines and rejects redirects. Only the already-dispatched diagnostic receipt route may use a fresh bounded signal after cancellation; backend execution binding and append-only constraints remain authoritative.

The owner-only controller page exists only under an exact configured paid approval. It cannot create approvals, change configuration, set budgets, or expose capabilities. Its cancel disconnect aborts the server controller; a process hardkill cannot run finally, so the30second owner lease remains the crash fallback. Already transmitted provider requests cannot be recalled or guaranteed unbilled.

## Safe hosted verification

Existing owner-only inert page invokes the SAME Node core with actual shared lifecycle/CAS in a separate owner/nonce namespace. Scenarios are fixed: success with real renewal, lost prepare/activation/initialization responses, cancellation, revocation, expiry, renewal failure, isolated storage failure, timeout and cleanup interruption. No provider, operational task, grant or reservation can be created. Injected faults are not a real cloud Redis outage. Actual local Node SIGKILL against disposable real Redis proves before/after30second lease behavior; do not label it hosted function hardkill. Current workspace/session/member ownership is rechecked at consequential owner boundaries.

## Prevention and acceptance

Mandatory contract preflight includes independent Node QA/Auditor tests, actualrunPilot five-stage request-only mocks, actualsupervisor+HTTPworker composition, historical frozen failures and adversarial receipt/state/acceptance checks. Release lock includes the controller, remote worker, owner page, API, supervisor duration and existing trusted capture/request sources. Full suites do not establish live-model accuracy.

The existing Pro hosting allowance supports a660second function limit:600seconds task plus bounded cleanup. This is a Preview branch configuration only; no hosting plan or billing change. Before each live pilot verify actual deployed duration, current release/source, model/project/financial constraints, disabled rollback, owner session and worker credentials. Separate original/replacement hosted readbacks remain mandatory.

## Existing High risks for read-only execution

AO01–04: durable lifecycle, diagnostic preservation, capture lock and actual controller integration require fresh exact-release evidence; previous verified controls are preserved. AO05: reviewer attestations share trusted parent, so independent human acceptance remains required for the supervised pilot. AO06: serialize one workflow with no unrelated ledger mutations; do not weaken Chief snapshot checks. AO07: internal holds do not cap external charges; preserve uncertainty and seek explicit cost acknowledgment. AO09: no operational alert adapters, so supervise actively and verify shutdown manually. AO11: prompt/visual untrustworthiness requires evidence-first QA and independent image assessment; no model can accept its own work. No Critical issue is assumed merely from a missing test.

Before autonomous writes, distinct reviewer attestations, monitoring, capacity-aware archival, dependency-scoped versions, clock-skew bounds and rollback/write permissions remain separate future work. Four logical departments, Engineering Auditor role and disabled recovery foundations are unchanged.

## Build configuration identity

The first36b59ac Preview build failed closed: Vercel minified vercel.json before npm build, unlike the GitHub checkout. A diagnostic-only Preview build printed identical parsed configuration and the differing raw-source fingerprint. The release now fingerprints onlyvercel.json as parsed JSON, preserving every key/value/type and array order. Whitespace can differ; semantic changes and malformedJSON still fail closed. All other selected sources retain exact normalized-text binding.
