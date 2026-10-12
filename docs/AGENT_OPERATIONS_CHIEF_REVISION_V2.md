# Chief intent v2 — backend-owned revision contract

## Verified failure

The preserved single-call pilot wf_6f21d82fb9bf4df89527761ee6e40d3d returned HTTP200/completed. The Chief returned task revision2 in `expectedRevision`; the parser required global snapshot revision212. Both revision namespaces appeared in the input, while the generic integer response schema did not distinguish them. Earlier native mocked responses populated the parser's global revision directly, hiding this integration defect. Strict JSON schema guarantees shape, not the semantic choice of a revision namespace. This was a contract/design defect, not evidence of an OpenAI access failure or merely an inadequate prompt.

The prior offline reconstruction matched the exact request hash f2b1e10c53d3649cb6ad08ca686d88cd1360777fbf3d795f61832b7e6e8d05bb and context hash314ec1c05edd34e030f936a5a9619714b286a588529e4efb82e3a1d409252b4c. Original response remained unchanged; changing2→212 only in a diagnostic copy passed the legacy parser. That experiment was not a settlement or correction of the live response. The original $0.30 hold remains pending. Observed3159input/215output tokens imply$0.008468 at pinned rates, distinct from settled/invoice charges. All earlier history is preserved.

## Corrected contract

New tasks and new temporary approvals explicitly bind `chiefContractVersion=chief-intent-v2`. Old approvals cannot dispatch v2. The legacy Chief builder/parser remains unchanged for historical replay; no old output is reinterpreted as v2.

The model emits **only `{action,agent,reason}`**, through strict `delegate_inspection_v2`. The action and specialist are constrained to the authorized read-only assignment. There is no model-produced task ID, revision, context hash, execution ID, permission or acceptance flag. Extra authority fields, including either revision2 or212, are rejected rather than replaced. Final serialized request size is checked after installing the new schema/instructions. GPT-6.1 Sol Medium,20koutput, no-cache/default-tier, task budgets and stage limits are unchanged.

Before the one provider dispatch, the broker's atomic CAS transaction verifies current task revision/fence and global snapshot revision. It reconstructs the exact native request from the authoritative snapshot and bounded observation time, checks context/request hashes, then stores a server-derived immutable binding: contract, workflow/stage, task/snapshot revisions, execution, fence, grant/revision, approval/scope/context/request hashes, issuance and expiry. The provider's deterministic parser returns intent plus the binding's digest; it does not manufacture replacement revisions. The backend checks that digest and the stored execution against current live grants/approval/scope/fence/expiry before settlement and stage advancement.

Transport `expectedRevision` is still obtained from broker responses and checked atomically. Heartbeats/evidence advance transport revisions while preserving the original execution binding. The broker tracks its expected ledger revision across those own updates; an unrelated concurrent ledger mutation invalidates the Chief context and blocks completion. This conservative policy may stop otherwise harmless concurrent organizational work; it favors freshness and must not be bypassed by automatic paid retry. Cancellation, revocation, changed grant/approval, foreign binding, stale context, duplicate dispatch and replayed/concurrent completion fail closed. Only one completion settles. Pending costs remain conservative on failure.

Sanitized diagnostics retain bounded Chief contract rejection codes, provider request/response identifiers, usage/timing and hashes. No raw credential or context payload is added to diagnostic storage. Model capability boundaries, blind observations before claims, immutable images/results, evidence grounding, separate acceptance, and non-overridable Chief reporting remain intact.

## Verification

Local full suite **2103/2103** passed. Independent security reviewer **62/62** focused checks passed. Tests include task2/global212 under the real native HTTP mock, legacy ambiguity reproduction, extra authority/version/hash rejection, stale snapshot before fetch, unrelated mutations during inference, internal heartbeat scheduling, cancellation/grant changes after validated evidence but before finish, changed approval/fence, simultaneous finish and replay. No silent revision repair is used.

Complete five-stage native-provider mock roundtrips passed for accepted and correctly rejected specialist work: Chief, specialist, blind observation, adjudication, independent acceptance, final Chief. Four hash-verified fixture PNGs are supplied, observations sealed before claim disclosure, five separate mocked HTTP responses accounted, and rejected work remains rejected. Separate isolated mock workflows and the16-case adversarial/grounding suite also pass. These establish implementation behavior, not live model accuracy or successful v2 inference. No model requests are authorized or performed by this development task.

Hosted/remote final evidence is recorded in CALLERCORE_PROJECT_STATE.md after publication. The mobile admin data-readiness limitation remains unresolved. No claim of customer-launch or Production readiness follows.

Official compatibility reference: [OpenAI function calling](https://developers.openai.com/api/docs/guides/function-calling) documents strict function schemas, required fields and `additionalProperties:false`; backend state/concurrency validation remains CallerCore's responsibility.
