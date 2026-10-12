# Permanent engineering quality and failure prevention

## Scope and authority

Applies to Agent Operations, admin dashboard, client portal, public website, voice platform and shared backend. The contract-first release at4488666 is retained unchanged. Existing source-bound schemas, faithful mocks, frozen live replays, semantic acceptance, permission checks and spending reservations remain mandatory. This framework adds preventive development controls; it does not authorize execution, paid calls, writes, Production access or a new autonomous agent.

Engineering implements and supplies evidence. Independent QA evaluates user-visible behavior and substantive correctness without receiving expected answers. Engineering Auditor / Red Team independently challenges assumptions, boundaries, actual code and external contracts, negative paths and detection gaps. Quality & Risk may flag a blocking failure and escalate directly to the owner. Chief and department leads cannot override failed mandatory QA/security. A model's agreement or green suite is never authority to accept work or release it.

`lib/engineering-quality.js` defines review roles, conservative path-based risk floors, plan validation, independent acceptance predicates, non-inferred readiness dimensions and a sanitized anomaly evaluator. Auditor is a logical role with model execution disabled. Existing worker role allowlists, grants, permissions and execution contracts are unchanged. Acceptance helpers require a future trusted evidence store and authenticated independent identities; caller-supplied evidence strings are not trusted attestation. They are not exposed as an authorization endpoint.

## Proportional change protocol

Before substantial work: inventory scope/assets, data and money flows, trust boundaries, dependencies, abuse cases, assumptions, detection gaps, cancellation and rollback. Record a plan with intended verification. Amend the plan when actual changed bytes differ. The committed plan is a reviewable final binding, not automatic proof of when analysis occurred. Policy-control changes need independent Auditor review.

| Risk floor | Examples | Mandatory verification plan |
| --- | --- | --- |
| Routine | Documentation-only changes | Scope and truthful evidence review |
| Substantial | Public presentation and test changes | Risk analysis, targeted tests, independent QA, relevant Preview checks |
| Critical | AI autonomy, permissions, security, billing, customer data, telephony, integrations, backend, infrastructure, CI, unknown files | Threat model, targeted and full applicable regressions, independent QA and Auditor, negative-path analysis, rollback, CI, CodeQL, exact-source Preview |

The classifier is intentionally conservative: dashboard/client scripts are critical even for presentational edits; reviewed classification may raise risk, never lower the automated floor. Domain labels route review, not permissions. A small copy fix should use proportionate assertions and browser inspection, not new mirror tests. Pure-doc updates do not require another full application deployment exercise. Unknown/renamed/deleted paths are classified; file paths are not model self-descriptions. Path rules cannot detect every behavioral consequence in a public script: reviewers must raise its risk for embedded integrations, customer flows or authority changes.

Run `npm run preflight:engineering -- --working` to obtain actual changed Git blob bindings (tracked, untracked and deleted files). Add exactly one matching JSON plan under `docs/engineering-changes/`. Use `npm run preflight:engineering -- --base <verified-before-sha>` after committing. CI runs this non-optional gate with complete history; it validates every new linear commit, not just the last one. Missing history, merges, missing/stale/duplicate plan, downgrade, absent threat model or negative-path rationale blocks CI. Adoption starts at verified local checkpointedc7a89; earlier history is not retroactively represented as compliant. The manifest JSON cannot execute commands. Its own plan bytes are excluded from the digest to avoid self-reference; plans are declarative and reviewed, not runtime policy. Other files are hashed as Git blobs. No automatic record generation/approval in CI.

The CI gate establishes **plan completeness, actual source binding and policy regression success**, not independent review authenticity or completed hosted/live acceptance. Existing contract preflight remains mandatory separately. Read-only GitHub ruleset18273298 inspection confirms existing default-branch protection requires `test` and `Analyze JavaScript`, with CodeQL high/errors gating and no bypass actors. The new engineering gate runs inside required `test`. This rule targets the default branch, not feature publication; it requires zero approving reviews and no code-owner approval. Trusted reviewer attestations and mandatory independent-review enforcement still need implementation. No branch rule was changed. Feature stays draft/unmerged.

Future live-pilot preparation must run `npm run preflight:live -- --base <verified-before-sha>`: the reusable offline wrapper requires a clean committed tree and runs both engineering and contract gates with provider credentials stripped. It never activates anything or mints approval. Exact-source hosted evidence, actual independent reviews, current accounting and separate owner authorization remain required outside this offline prerequisite. Backend permissions still enforce current execution authority; this local report is not a signed release attestation.

## Contract-first and defect prevention

Before connecting any external boundary, align authoritative shared schema, exact model/client instructions, request envelope and backend validation. Use request-only doubles that see precisely what the real counterpart receives. Never inject internal revisions, hidden IDs, oracle answers or expected verdicts. Freeze sanitized real responses with provenance/hash; preserve originals and replay unchanged. Cover schema extremes, invalid enums, bounds, extra authority fields and semantic contradictions. Lock drift before dispatch and in CI. Do not silently repair invalid live responses.

Significant defects require root cause, detection gap, permanent regression and counterfactual prevention evidence in the change plan. For the two historical Agent Operations failures, retain the original Chief2/global212 and invalid29fact observation replays and zero-dispatch assertions from `tests/agent-operations-contract-first.test.js`. Do not duplicate or rerun paid investigations. A synthetic replay of an unreached stage is labelled synthetic; adjudication/final Chief are not live verified.

For each critical change assess all nine paths: malformed response, stale state, concurrency, cancellation, interrupted worker, provider outage, authorization denial, spending exhaustion and partial execution. Reference meaningful tests where applicable; explain non-applicability rather than inventing coverage. Independent review challenges those explanations. Interruption after provider dispatch retains uncertain reservations, no blind retry. External integration work needs sanitized contract documentation and offline failure simulation before separately approved live testing. Voice lexical/mock tests cannot establish PSTN/acoustic or real customer acceptance.

## Readiness and acceptance

Maintain separate source-bound rows for unit, integration, contract replay, mock E2E, live and Production evidence. Each verified cell needs exact source/artifact binding, outcome, limitations and evidence reference. Missing, stale or failed evidence is unverified. Lower levels never imply higher levels. Structural validity, integrity, substantive accuracy and final acceptance stay separate. A failed or unknown mandatory gate blocks acceptance even if execution completed.

The pure `acceptance()` predicate rejects Engineering/Chief as QA, reused reviewer execution IDs, source mismatch and failed QA/Auditor. It returns no execution permission. Future wiring must authenticate the reviewers, persist immutable attestations and recheck backend acceptance atomically; a string execution ID alone cannot establish independence.

## Monitoring preparation

`anomalies()` evaluates bounded sanitized telemetry counters only: failures, stalls, rejected work, external API errors, retained/pending accounting, unusual spend and storage/broker/Preview-identity/provider health. Stale (>5minutes), absent, invalid, future-dated or unknown dependency evidence fails visibly. Output contains allowlisted codes/severity only; never raw task text, error messages, IDs, credentials or payloads. Pending holds are reported, never released. Provider health stays unknown unless established by authorized existing evidence; monitoring must not send a model request to probe it.

This is an offline-tested evaluator, **not an active monitor, scheduler, notifier or incident responder**. Next: read-only adapters from durable tasks/leases/usage and existing infrastructure metrics; heartbeat/freshness checks; durable deduplication and incident history; authenticated owner-only status; separately authorized routing. Define expected spend from trusted approved reservations, never a model's estimate. No automated paid retry, write remediation or new telemetry export.

## Current evidence and highest risks

The existing contract-first readiness matrix remains authoritative in `AGENT_OPERATIONS_CONTRACT_FIRST.md`. New quality policy/gate are offline verified only until exact CI/Preview evidence is recorded in the canonical handoff. No new live or Production proof is claimed.

| Capability | Unit | Integration | Contract replay | Mock E2E | Live / Production |
| --- | --- | --- | --- | --- | --- |
| Risk, plan, acceptance and readiness evaluators | Targeted/adversarial tests | Git/CLI boundary tests for plans | Not a provider contract | Not an agent workflow | Unverified / unverified |
| Per-commit engineering gate | Digest/plan negatives | Actual clean Git history and CI checked at publication | Not applicable | No model | Unverified / unverified |
| Sanitized anomaly rules | Counter/freshness/negative tests | Operational adapters absent | Not applicable | Synthetic counters only | Unverified / unverified |
| Auditor role metadata and organization roadmap | Boundary policy tests | Runtime role not enabled | Not applicable | No Auditor model | Unverified / unverified |
| Existing five-stage contracts | Existing tests retained | Native provider/backend mock integration retained | Immutable historical Chief/observation failures retained | Accepted/rejected five-stage paths retained | New shared release unverified / unverified |

Exact pass counts, source SHAs and hosted run IDs are recorded in the canonical handoff. Hosted regression confirms preserved application behavior and disabled safeguards, not execution of the new logical roles or monitoring.

Priority order:

1. Preserve disabled execution and current accounting; connect trusted review identity/evidence admission and independent-review enforcement before enabling any write executor. Preserve existing required main test/CodeQL rules; assess separate feature publication policy before autonomous writes.
2. Add read-only operational telemetry adapters and independently test stall/lease expiry, partial execution and spend-anomaly detection; do not activate notifications or remediation by assumption.
3. Resolve mobile admin loaded-data readiness; expand source-bound acceptance across client/admin/voice integrations proportionately.
4. Complete separately authorized five-stage live contract/accuracy proof; corrected observation, organization adjudication and final Chief still lack successful live evidence. Keep semantic evidence relevance limitations explicit.
5. Add department routing and contextual ingestion only when workload justifies it. Autonomous engineering grants/executors, audit attestations and safe rollback require separate implementation and activation approval.

Historical $7/$15 retained, $2.20 pending and $0.128106 known settled token-derived usage remain unchanged; no invoice reconciliation or hold release follows from these controls.
