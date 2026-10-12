# CallerCore Chief model and graduated autonomy architecture

This is Preview-only preparation. Paid execution and new write capabilities remain disabled. QA hardening was completed first at7477f21, including exact-source hosted browser checks. Historical execution profiles, screenshots, findings, observations, verdicts and reservations are immutable.

## Model selection and native contract

Preferred Chief of Staff: **gpt-6.1-sol, Medium**. Preferred independent visual reviewer: **gpt-6.1-sol, Medium**. GPT-4.1 remains explicitly selectable for simple, low-consequence coordination or controlled comparisons, with no automatic fallback after failure. Existing historical delegation/smoke/QA profiles retain their original pinned GPT-4.1 contracts and receipts; changing a preference never reinterprets them. Existing Website specialist path stays intact. Task difficulty/consequence are backend/operator classifications, not a route for the model to obtain extra authority. High-consequence tasks escalate; a stronger model/reasoning setting requires explicit model entitlement, pricing, stage allowance and scope authorization before a new request.

Prepared Chief native Responses builder supports strict JSON or exactly one strict function call: delegate_inspection, request_review or report. Tool names/action/agent/task/context hash/revision must agree. Unknown tools, multiple calls, ambiguous simultaneous JSON/tool responses, refusals, foreign tasks, stale context and invalid usage fail closed. There is no inference function, paid Chief initializer, autonomous tool loop or new action executor in this preparation. The existing isolated project credential/authentication helper is reused; no credential/billing/project-permission changes.

Sol contract: Medium, standard/default tier, explicit no-cache, store=false, truncation disabled; 20,000 total output tokens including reasoning, 180-second request cap. Entire serialized body capped32,000UTF-8bytes; 32,000 planning input tokens plus20,000 output is well below documented1,050,000context/128,000output maxima. Short-context published rates$2/Minput+$10/Moutput imply$0.264 planning maximum, with a proposed separate$0.30 reservation. Actual receipt guards32kinput/20koutput, default tier, zero cache counters, bounded reasoning and$0.30; anomalies retain uncertainty. Builder limits are enforced offline; no live Chief request, pre-dispatch token-count endpoint or invoice verification occurred. A future dispatcher must impose the180second/one-call/task deadline and reserve atomically; metadata does not activate one today.

Official sources: [Sol model contract](https://developers.openai.com/api/docs/models/gpt-6.1-sol), [function calling](https://developers.openai.com/api/docs/guides/function-calling), [structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs). These establish documented compatibility, not a successful live Chief inference/tool execution.

## Verified context layer

The backend projects a bounded snapshot from the authoritative Agent Operations store: organization/project IDs, state revision/timestamps, pinned Preview scope, curated verified project milestones with source IDs/hashes and qualifications, configured agent capabilities/model preferences, task status/revisions/deadlines, blockers, retained ceilings, pending uncertainty, known settled usage and owner decisions. It omits raw findings, provider payloads, credentials, principal identifiers and arbitrary extra fields. Execution verification remains distinct from substantive/final acceptance. Canonical acceptedWork requires structural, integrity, substantive and final acceptance gates. Pending observed costs are not labelled settled. Historical failed results remain available as failed evidence.

Context expires after five minutes and is hash-bound; tampering/staleness/over-budget snapshots fail validation. **A hash is integrity, not authentication.** Future dispatch must assemble/re-read the snapshot inside the trusted backend; it must never accept a caller/model-supplied context or grant as authoritative. These curated milestones are a small verified project-history layer, not a claim that all CallerCore organizational knowledge or connected services are integrated. Add future organizational sources through separately scoped verified ingestion with provenance and freshness. Chief context must never be merged into blind independent-QA inputs.

## Graduated autonomy and approval boundaries

The intended Chief is an autonomous operator within an owner-issued backend grant, not a permanently read-only coordinator. The present kernel is disabled and has no write executors. Future grants should allow repeated routine work without per-step owner approvals, bounded by role, action/path allowlists, pinned branch/source, expiry, model/cost allowance, action quota and revocation.

| Level | Future authority inside a verified grant |
| --- | --- |
| Observe | Read internal authorized state |
| Coordinate | Plan, prioritize, delegate, monitor and report |
| Inspect and test | Read-only Preview inspection, tests and independent QA |
| Engineering Preview | Minor fixes, verified feature commits and routine follow-up coordination |

Substantial, destructive, irreversible, financially significant, legally sensitive, customer-impacting or Production-facing actions require owner escalation. This Preview policy never delegates main merges, Production deployment, customer mutation, policy edits, permission grants, budget increases or acceptance of failed QA. Protected control-plane scripts, dependencies/config/workflows/credentials/policy files and noncanonical/Windows device/drive/stream path aliases are denied even if mistakenly listed in a grant. Routine risk must come from trusted backend classification, not the model's action description.

The policy kernel rejects stale task/grant revisions, terminal/cancelled tasks, expired deadlines, exhausted action quotas, out-of-scope project/branch/source/paths, insufficient retained headroom and ungranted paid models. A proposed feature commit needs independent accepted QA bound to the exact task, revision, source and implementation artifact, with distinct implementation/reviewer executions. The model cannot turn a structurally valid failed verdict into accepted work.

## Durable execution and rollback implementation plan

Next implementation must introduce a versioned owner-issued grant registry and transactional executor, not expose today's policy helper as an execution API. In one atomic backend admission, re-read grant/task/cancellation/source revisions, classify the action, validate policy, reserve spending/action quota and append an audit event. Only then issue a task-bound lease to an allowlisted specialist executor. Save context/policy/decision digests and artifact/source bindings with the task. Recheck grant revocation and cancellation before each external dispatch and before committing verified work. Leases, idempotency and no automatic paid retry remain authoritative. Unknown outcomes remain blocked with conservative reservations.

Write executors require isolated feature workspaces, bounded diff/path checks and independent tests/QA before commit. Rollback must be action-specific and recorded: abandon an uncommitted isolated change, or propose/perform a granted feature revert only after checking source and unrelated work. No generic destructive shell capability or Production rollback authority is granted. Cancellation stops new dispatch, revokes leases and prevents pending writes; it cannot undo a provider charge already incurred. Follow-up tasks must remain within the same grant/quota/budget and cannot recursively mint grants or change policy.

Audit decisions returned by the kernel require durable atomic recording and reservation before execution. Current pure helper tests demonstrate decisions and guards; they do **not** establish that a live autonomous engineering executor, grant persistence/rollback flow, full mixed-model pipeline or long-running organization manager already exists.

## Next milestone and current gates

The complete intended workflow is Chief Sol Medium → task-appropriate specialist → blind Sol observation → independent Sol adjudication/acceptance, with separate task/evidence binding and backend admission at every stage. Preserve the existing specialist delegation infrastructure; add fresh-result QA binding and a mixed-model executor through separately reviewed implementation. Do not route around preferred QA using the legacy all-GPT-4.1 workflow.

Current retained allowance is$4.40/$5; original$0.60 uncertain holds plus prior incomplete$0.30 remain$0.90 pending, known settled token-derived$0.106654. No holds were released or reclassified. Existing Chief/specialist reservations$0.60 plusSolQA$2 require$2.60; only$0.60 remains. A whole live workflow is therefore **not ready**. Budget-policy/reconciliation decisions and dynamic fresh-result wiring remain gates. A future single Chief contract smoke could fit a proposed$0.30 hold, but it has no current live initializer or approval and must be separately implemented/verified/authorized before inference. No additional paid test is requested as part of this checkpoint.
