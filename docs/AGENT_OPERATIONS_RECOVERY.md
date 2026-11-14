# Autonomous issue resolution and workflow recovery

## Current boundary

`lib/agent-operations-recovery.js` is a pure **offline planning/simulation foundation**, not a broker route, execution adapter, grant issuer, paid retry mechanism, durable store or authority verifier. No runtime imports it. Every plan records `enabled=false`, `paidEnabled=false`, `writesEnabled=false`. Beginning an attempt requires explicit offline mode, zero model calls, zero reservations and zero external actions. The current five-stage read-only pilot remains unchanged. The existing organization lease-recovery/cancellation mechanism remains separate: lease cleanup does not authorize remediation or another model invocation.

The foundation evaluates caller-supplied trusted backend classifications and exact original task/evidence/findings/QA/revision/accounting bindings. A model's proposed risk description is not an authority source. No field can release a pending reservation or overwrite original acceptance. Runtime adoption requires authenticated backend classification, trusted review attestations, atomic storage/admission and independently reviewed execution adapters; the pure function alone provides none of those trust guarantees.

## Future workflow and authority

1. Preserve original specialist output, failure, screenshots, independent QA and uncertainty. Return a sanitized failure envelope containing failure ID, evidence hash, severity, root-cause code, recoverability, required permissions, business impact and estimated cost. Unknown classifications escalate instead of defaulting to routine.
2. Chief proposes an investigation. Trusted backend policy decides which existing owner-approved grant, specialist, scope, budget and checkpoint are applicable. Routine authorized issues may proceed without another owner interaction. Chief cannot modify this policy, grant new permissions or reinterpret QA failure.
3. An appropriate engineering/design specialist investigates and, only under future explicit write authority, produces a new candidate artifact. A different specialist or Engineering Auditor may be assigned when needed. Auditor investigates safeguards and negative paths; Independent QA evaluates the candidate; neither is the implementation owner.
4. Independent QA evaluates fresh candidate evidence under a fresh task binding. Original rejected/uncertain QA remains immutable. A successful remediation adds a separate accepted candidate and resolution record; it does not relabel old work. Backend acceptance remains mandatory and cannot be waived by Chief or department leads.
5. Resume only from a validated checkpoint whose input dependencies, code/evidence hashes, grant, revision, lease, spending allowance and QA bindings are current. An earlier independent review must be invalidated for acceptance purposes whenever its reviewed candidate changes, while its historical record is retained. Chief reports resolution, unresolved limitations or owner escalation truthfully.

High/critical severity, security, permission changes, billing, customer data, telephony, Production, destructive/irreversible actions, legally sensitive or financially significant consequences, material/unknown business impact, unknown risk or unknown/permanent recoverability block routine recovery and require owner escalation. Future grants must expressly cover any consequential action; a plan or role title is never a grant. Unrelated authorized tasks can continue because one task's recovery state is not a global organization lock.

## States, bounds and audit

| State | Meaning |
| --- | --- |
| Investigating | Routine classified failure awaits a bounded investigation attempt. |
| Remediation in Progress | Separate candidate is being investigated/prepared; original task is not accepted. |
| Awaiting Independent QA | Candidate artifact/execution binding is frozen for separate review. |
| Blocked — Owner Approval Required | Trusted policy identifies risk outside routine authority. |
| Resolved | Offline candidate has a complete independent passing fixture receipt; no executor authorization is implied. |
| Escalated | Attempts/repeated failures exhausted or explicit escalation. |
| Cancelled | No further attempt/continuation can be admitted. |

Current simulated bounds are configurable downward: at most three attempts, three repeated failures, ten minutes and two concurrent attempts. Estimated remediation cost must fit the plan allowance and cumulative internal ceiling (never above $15); this is admission arithmetic, not an API billing guarantee or actual reservation. Current actual model/API spend is always zero. Retained accounting and pending uncertainty are immutable inputs, including the historical $7 retained/$2.20 pending checkpoint. An adapter must reread the authoritative ledger before any future atomic admission; a caller-supplied snapshot is not a new reservation.

Transitions require expected revision and original task hashes/revision. Same-ID/same-payload replay returns the unchanged plan and performs no action; conflicting replay fails. Cancellation and terminal states block new transitions. Audit entries hash-link original task, failure, attempt number, candidate, independent QA and resolution. Changed candidates clear the prior proposed checkpoint and review. A successful fixture produces a non-executable checkpoint requiring fresh binding, and `acceptedWork` stays false in this foundation. Caller cancellation is checked on fresh transitions; an idempotent replay never initiates execution.

## Implemented evidence and limitations

Seven offline test groups cover a resolved candidate; failed/uncertain review with bounded retries; all consequential risk classes and ignored model risk proposals; CAS/stale/evidence/accounting changes, replay and cancellation; duration/concurrency/budget/permissions and denied paid dispatch; self-review, stale/mismatched review and incomplete acceptance; linked failures, changed specialists and unrelated-plan isolation.

The receipts are explicitly `fixtureOnly`; no untrusted production receipt can be represented as a trusted attestation. Input snapshots/audit chains are not authenticated or persisted by this module. CAS is simulated revision checking, not a Redis transaction. Actual concurrency counts and ledger freshness need an atomic durable adapter. No worker resumes, notifications, artifact mutation, repository writes, grants, Auditor model calls or active monitoring are implemented. Passing tests establishes offline policy behavior only; no recovery capability is live-verified or Production-verified.

Implementation order: (1) authenticated failure envelopes and durable append-only recovery records using existing Redis CAS/lease patterns; (2) independent review attestations and task-scoped read-only investigation adapters; (3) explicit owner-issued bounded engineering grants with isolated executors, candidate rollback and dependency-aware checkpoint invalidation; (4) separately authorized measured recovery trials; (5) departmental routing and Auditor runtime when justified. Every step remains subject to permanent engineering risk/contract gates and separate permission/paid-execution authorization.
