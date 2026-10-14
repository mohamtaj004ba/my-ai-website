# Phase B — bounded internal operations

Status: implementation under strict verification; no new paid agents or tools are activated.

## Risk and trust boundaries

This critical change extends the existing Preview broker and workspace-owner policy. The browser is untrusted; every command reauthenticates owner/workspace membership on the server. The new journal uses the existing Redis client and Lua CAS in an owner/workspace namespace. It never writes the original execution/spending ledger. The authoritative ledger remains the source for historical activity, evidence manifests, reservations, pending uncertainty and approvals.

The main threats are foreign-workspace leakage, replay/duplicate execution, stale browser responses, source movement during a report, cancellation racing publication, lost committed replies, corrupt persisted authority flags and storage capacity blocking cleanup. Negative-path tests exercise those boundaries through real service/API/UI code. No provider transport, browser executor, filesystem executor, credential delivery or deployment executor is reachable from the four new report primitives.

## Implemented scope

Four departments have logical leads and explicit role/tool boundaries: Engineering & Product; Quality, Security & Reliability; Business & Growth; Finance & Operations. Business profiles and most future specialist capabilities are inactive. Department cards are a permissions roadmap, not operating AI agents.

The Chief routing layer is deterministic and permits only evidence-inventory, budget-audit, runtime-health and contract-readiness reports. Owner-submitted DAGs persist priorities, task ownership, exact release bindings, prerequisites, attempt fences, leases, cancellation, output hashes, separate backend verification receipts and consolidated results. No recursive delegation, model calls, reservations, customer access or autonomous writes are available. Internal contract verification never grants business acceptance and never substitutes for independent human/model QA.

One explicit owner-requested recovery is available for eligible interrupted internal reports within the original deadline and release. No automatic retry or renewal exists. Revoked/cancelled authority and stale releases cannot be restored. Original attempt evidence remains.

Monitoring describes successful reads as observed availability. Provider/browser availability remains unknown unless real evidence supports a historical receipt. Incidents have severity, ownership, original evidence, snapshot provenance, deduplication, acknowledgement/escalation, recurrence and qualified clearance. Clearance means absent as of a recorded read, not atomic current health or task acceptance. No external alerts or recurring paid probes are enabled.

## Owner dashboard

The existing authenticated Agent Operations page contains an internal coordination panel: health, templates, departmental roles, real persisted task details, dependencies, receipts, historical activity, spending attribution, incidents, administrative audit and internal emergency stop. Existing paid Pilot Control and non-billable verification remain separate. Internal emergency stop cancels internal plans only; paid authority still uses existing central revocation controls.

Mutation delivery uncertainty retains an owner/workspace-bound idempotency key. Refresh reconciles committed assignments; there is no automatic resend. Stale lower-revision responses, malformed readbacks and session-loss responses cannot report success or restore controls.

## Corrections found during independent review

Preserved initial failing tests demonstrated dependency-recovery deadlock, consumed-approval expiry omission, stale UI/session responses and insufficient draft isolation. Source review also identified cross-workspace audit/top-level control projection leakage, audit-capacity cleanup blockage and insufficient stored-record validation. These are corrected with scoped projections, zero-authority/DAG/receipt invariants, normal-admission and cleanup reserves, expired-deadline visibility and snapshot-bound incidents. Failed artifacts are retained under ignored artifacts/agent-operations.

## Verification and remaining work

Targeted actual-interface tests cover routing, concurrent replay, cancellation/source movement, lost committed claims, bounded recovery, stale releases, storage outages, fabricated report authority, incidents, tenant isolation and browser response ordering. A disposable real Redis case exercises CAS and original ledger immutability. Mandatory contract preflight includes Phase B cases. Full frozen STRICT, CI/CodeQL and exact-release authenticated Preview verification must be recorded before declaring this implementation hosted verified.

Remaining limitations: no model planning accuracy measurement; no new independent human identity; no notification adapter, persistent worker scheduler, actual process heartbeat probe, cloud Redis outage injection or autonomous tool executor. Department cost attribution uses only supported recorded stages; unknowns stay unattributed. The existing $15 ceiling and $10.60 retained including $2.20 uncertainty remain authoritative; no new spending or settlement occurs.

Phase C prerequisites: separate owner authorization for narrowly scoped development tools, trusted independent reviewer identity where required, risk-specific execution policy, rollback evidence, monitored canary limits and fresh release/financial preflight. Nothing here activates those capabilities.


### Initial hosted packaging failure preserved

Initial source abb1205 passed frozen2541 tests and CI/Redis but hosted owner and restricted-worker GET returned BROKER_STORAGE_UNCONFIRMED. Preserved Phase A exact broker still read the same ledger successfully. Actual installed Vercel Node File Trace, after Windows path normalization, identified exactly one missing runtime fingerprint asset: agent-operations-command-center.css. The stylesheet had only a dynamic file-list reference. An explicit literal require.resolve in the existing source map preserves hashing while tracing the asset. Corrected trace covers all74required files with zero missing. A mandatory non-JavaScript asset-reference regression and original-omission counterfactual pass; these lexical checks plus actual local tracer evidence do not replace successful hosted exact-release readback. The failed Browser run and trace artifacts are preserved.
