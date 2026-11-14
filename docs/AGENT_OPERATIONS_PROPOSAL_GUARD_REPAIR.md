# Engineering proposal-copy guard repair

## Evidence and scope

Trial 2 on application `90a86019d2ee31c1220edaa3ea919db7ca9d1172` completed JSON/schema, evidence-reference and source-preimage checks before `ENG_AI_PROPOSAL_DENIED`. The original text and matching predicate were not retained. Its exact cause remains unknown; neither a false positive nor malicious output can be attributed retrospectively. Original Chief/failure receipts, decisions, grants, accounting and immutable history must remain unchanged.

Offline reproduction proves a separate current defect: the old unanchored `sk-` expression matches ordinary word endings in `risk-adjusted`, `task-based` and `desk-based`. The repair requires a token boundary before that prefix, using Unicode letter/number/underscore semantics. Standalone and punctuation-delimited prefixes remain denied. This is not a comprehensive credential detector; transport also rejects echo of the actual supplied API credential, and no credentials are included in model inputs. No text is normalized, repaired or silently stripped.

## Rejection map

| Boundary | Inspected material | Failure | Meaning |
| --- | --- | --- | --- |
| Provider envelope/output | Completed status, exact model/tier, one assistant output text, no tool calls/refusal | ENG_TRANSPORT_RESPONSE / OUTPUT | Protocol/completion/refusal shape, not engineering acceptance |
| Usage | Nonnegative bounded input/output/reasoning/cache counts | ENG_TRANSPORT_USAGE | Provider accounting validation |
| JSON/schema | Entire decoded structured object, strict fields, lengths and enums | ENG_AI_RESPONSE_SCHEMA / OUTPUT_LIMIT | Ordinary validation; unknown properties cannot grant tools or authority |
| Finding identity | Unique finding IDs | ENG_AI_FINDING_IDS | Ordinary validation |
| Evidence | Every cited ID must be in supplied exact evidence; no duplicate IDs | ENG_AI_EVIDENCE_REFERENCE | Source-reference validation |
| Preimage | `proposal.beforeText` is an exact substring of a cited dashboard.html excerpt, differs from afterText | ENG_AI_PROPOSAL_PREIMAGE | Source-bound proposal validation |
| Replacement copy | Only decoded `proposal.afterText`, as-is, first matching rule in the order below | ENG_AI_PROPOSAL_DENIED | Plain-copy content policy; not a determination of malicious intent |
| QA | All original findings, related original evidence | ENG_AI_QA_COMPLETENESS / FINDING_IDS / UNRELATED_EVIDENCE | Review completeness |
| Chief final | Exact QA reasons/decisions/evidence and Auditor decision; acceptedWork false | ENG_AI_FINAL_AUTHORITY / FINAL_QA_CHANGED | Cannot rewrite criticism or grant acceptance |
| Trusted backend | Owner/workspace, task/source/release/pins, grant/revision/expiry, one-time consumption, budget, count proof, cancellation and emergency stop | Existing controller/profile/transport authority denials | Actual execution authorization, independent of wording |

The replacement field remains a plain UI label, not an HTML line or general code-patch schema. Safe code explanations, repository paths, defensive quoted examples and recommendations belong in `findings`, `uncertainty` and `proposal.reason`; these fields remain untrusted inert data. Their content never authorizes execution. Literal markup or URLs in replacement copy remain rejected even when quoted for defense. `Bearer of good news` is still conservatively rejected in replacement copy; no broader bearer relaxation is justified for this task. Entities or escaped-looking strings are not executed or decoded beyond JSON parsing; the artifact does not apply itself to a page.

## Sanitized rule receipts

All rules retain error code `ENG_AI_PROPOSAL_DENIED`, phase `response-validate`, stage `specialist`, location `$.proposal.afterText`, category `validation`, and classification `content-policy`. Fixed rule IDs distinguish:

1. `proposal-copy-markup-v1`: literal angle bracket.
2. `proposal-copy-nul-v1`: NUL character.
3. `proposal-copy-url-v1`: HTTP(S) scheme pattern, unchanged.
4. `proposal-copy-bearer-v1`: bearer/whitespace pattern, unchanged.
5. `proposal-copy-key-prefix-v1`: standalone or punctuation-delimited sk- prefix.

Only the first matching rule is recorded. No rejected text, substring, offset, exception message or arbitrary model property is stored. An unversioned provider prompt clarification was withdrawn after independent audit showed historical request-hash readback would fail. Existing request instructions remain byte-equivalent; the plain-label contract is clarified in this document rather than rewriting historical request construction. An actual preserved five-stage hosted fixture now verifies historical request hashes and synthetic usage. The existing sanitizer derives the rule ID and classification from a closed map only for the known code/stage/phase. Historical generic proposal-denied receipts remain valid and are not enriched retroactively. Existing broker capability checks, first-write-only failure hashes and server-derived source/release/task/request/evidence identities remain unchanged. Observed usage is recorded before content validation and retained after rejection. No diagnostic metadata creates reviewer or execution authority.

## Verification and rollback

Focused tests cover old false positives, benign multilingual copy, all five content rules, escaped JSON and deterministic rule priority; malformed and forged diagnostic labels/paths; immutable transport failure receipts/usage/cleanup; all five CAS transport stages with inert hostile explanations; all five existing restricted fixture-worker stages; controller replay, model/scope/token/spending denials and dormant third-trial selection. Existing tests cover cancellation, timeouts, storage failures, forged acceptance, prompt injection and prohibited mutation boundaries. Fixtures are not live-model compatibility or semantic acceptance.

Rollback: keep paid/count flags false and all historical approvals revoked. Preserve historical records, byte/audit retention limits and cleanup. Revert the narrow guard/prompt increment only as a reviewed application release with a regenerated release lock. Do not delete history, reset consumed markers, or infer a paid retry from rollback.

## Trial 3 preparation (not authorization)

The dormant descriptor `owner-third-average-daily-calls-once` supports the same Average daily calls/active-day source investigation through the existing controller. It grants nothing by itself. Before a run, obtain fresh explicit consent bound to the qualified application/fingerprint, configure matching trusted Preview-only policy/readiness pins and a configuration-only refresh, then create a fresh just-in-time assignment/execution identity from current source evidence. Do not reuse either historical task or approval. Creating a ten-minute live assignment before consent would expire needlessly; the source-backed specification is prepared now, with actual admission reserved until authorization.

Existing enforceable envelope: gpt-6.1-sol medium, at most five Responses and five counting requests, 60,000 combined input / 20,000 combined output, 12,000 / 4,000 per call, 150 seconds per stage and ten minutes overall plus bounded cleanup, $1 new internal ceiling. No automatic retry, recurring execution, generated-code execution, internal publication or independent acceptance. Smaller ceilings require changes to the existing fixed controller and may constrain full five-stage review; no unenforced smaller guarantee is promised. Historical usage is small but does not establish the remaining three stages' needs. The $1 limit is internal, not a provider billing cap; counting fees and provider adjustments remain unresolved. Current last verified ledger: $11.40 retained including $3 pending, $3.60 headroom. No new paid request or reservation is authorized by this repair.
