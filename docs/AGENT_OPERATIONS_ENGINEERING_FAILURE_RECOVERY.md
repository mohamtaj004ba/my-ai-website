# First live engineering trial: forensic findings and diagnostic repair

## Historical evidence, preserved unchanged

The one authorized trial used application `aeaa917491205a68aa24846490f3a61b2686d8e1`, release `c9934774046f2737618e4aef076c5647dbdc094b7012257c7d46a05b44ec41ba`, and workflow `wf_e7645aec7fe554b6de7ed10dca476d07`. The Chief produced a validated source-backed delegation. The Specialist produced HTTP200 and reported usage, but no validated result. QA, Auditor and final Chief stages were not invoked. No retry is authorized.

The Specialist count proof and Responses usage both report 1,330 input tokens. Output811, included reasoning215 and cache0 satisfy scalar limits. Bounded JSON decoding and the response diagnostic write completed. Failure occurred after that write: envelope/output/schema/semantic validation, post-parse authority verification, finish/persistence, or asynchronous authority cancellation remain possible. Normal150-second/10-minute elapsed deadlines were not reached. That does not rule out lease, cancellation or storage failures.

The original response structure/text and exception were not retained; `store:false` was used. A response hash cannot reconstruct them. Therefore the exact historical cause remains unknown. No parsing, schema or model defect is asserted as its cause. New synthetic failures must never be labelled recovered historical output.

## Confirmed defect corrected

The transport previously replaced every exception with `ENG_TRANSPORT_FAILED`, losing the failure location/code. It now retains a closed-vocabulary `engineering-failure-v1` diagnostic while preserving that public error code. The existing broker stores the first failure receipt once, with a hash/audit reference and server-derived workflow, execution, request, evidence, source and release identities. Original first-observed provider facts cannot be overwritten.

Metadata includes safe provider request/response identifiers, HTTP/completion states, incomplete reason, output/message/reasoning counts, refusal detection, model/tier match booleans, error-present boolean and observed token usage. Schema rejection adds a schema-derived field path and mismatch category. Exception text, stacks, prompts, model text, provider error messages, arbitrary keys and headers are excluded. Raw rejected artifacts remain intentionally unretained.

Failure phases distinguish admission, authority, count fetch/body/validation/record, dispatch, response fetch/body/validation and finish. Timeout, explicit cancellation and heartbeat authority loss are distinct. A `finish`/`persistence` category identifies the failing boundary, not proof of a storage root cause.

Observed usage is captured before awaiting its diagnostic write. A failed immediate write can be recovered by the bounded failure write; persistent storage failure returns sanitized observed facts and explicitly reports `diagnosticRecorded:false`. Storage outage cannot guarantee durable evidence. Diagnostic persistence and revocation have separate two-second bounds and run independently. No retry is added. Unknown exposure stays pending; no diagnostic settles financial reservations or grants acceptance.

## Non-billable verification

Independent QA fixtures use the actual shared-CAS organization broker and transport with synthetic Responses. They cover a valid inert Specialist proposal, malformed JSON, schema/additional-property errors, incomplete/refusal responses, semantic preimage denial, invalid usage, persistence failure, cancellation, timeout, capability forgery, immutable evidence and diagnostic-store failure. Existing five-stage fixture tests continue to preserve unresolved QA/Auditor decisions and prohibit acceptance/publication. A real disposable Redis race verifies concurrent diagnostic writes and cleanup preserve one immutable failure and revoke authority. No provider requests or generated code execution are needed for these tests.

Independent Work QA and Engineering Auditor review this repair. Their technical review is not independently authenticated human acceptance and does not retroactively accept the failed trial.

## Second-trial gate

Paid/count flags remain disabled and the original one-use exception remains consumed. No new credential, grant, reservation or provider request is authorized by this repair. A second live trial requires fresh exact source/release/task/model consent, a reviewed new one-use authorization identity, sufficient ledger headroom and final release qualification. The existing consumed exception must not be reset or relabelled. Current fixed controller limits remain5Responses/5counts,60kinput/20koutput,150seconds/stage,10minutes and1USD internal ceiling; an internal ceiling is not a provider billing cap. Smaller limits require corresponding controller enforcement, not merely a shorter prompt. The first trial's0.01695USD Responses calculation is not a future guarantee; count charges and provider adjustments remain unknown.

Historical accounting remains11USD retained, including2.60USD pending, with4USD headroom against15USD. This repair makes no provider accounting changes. Dedicated browser, Google resource access, Production and main permissions are unchanged.
