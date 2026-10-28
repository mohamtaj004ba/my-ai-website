# Shared engineering workflow review — 2026-10-27

This review uses the complete conversation supplied to this session, the current repository at `130143322c8b495bafdf113542a9bec547fb4acb`, the existing dirty canonical checkpoint, and preserved phone-trial evidence. Screenshots describe prior activity; they are not fresh execution evidence. The original receipts and failures are unchanged.

## Conclusion

The existing five-stage organization, provider adapter, authenticated controller, journals, disposable patch worker and qualified fixed-test machinery are reusable. The repeated failures do not justify replacing them. The central problem is duplicated, evolving contracts between those components, compounded by tests that sometimes generated both expected inputs and outputs from the same implementation.

Removing permissions alone would not repair these disagreements. Current development already has no application storage-count ceiling, internal dollar admission ceiling or ten-attempt ceiling. Historical dollar and attempt values remain records, not renewed authority or provider billing. One stale policy document incorrectly described the ten-attempt scope as enforced and is corrected in this change.

## Decisions reconciled from the conversation

| Earlier direction or failure | Current interpretation |
| --- | --- |
| Proposal-only Average daily calls rehearsals | Historical milestones; not the current product assignment. Workflow completion never implied proposal acceptance. |
| One file / one edit Starter demonstration | Historical task scope, not an appropriate global engineering limit. Current phone task spans five sites in two files; reusable bundle validation already supports manifest-defined scope. |
| Repeated dollar, attempt, storage and headroom increases | Current native development admission no longer enforces those removed administrative ceilings. Preserve the ledger, uncertainty and actual provider constraints. |
| Generic errors discarded failure causes | Existing sanitized diagnostics and immutable failure receipts remain. Do not guess lost Specialist output or retroactively classify an unknown rejection. |
| Broad text guards / syntax mismatch | Existing source, pure-expression and protected-path checks remain. Use shared rules and typed diagnostics; distinguish inert code data from authority to execute it. |
| Repeated short renewal / operation deadlines | Existing 60-second lease and 45-second renewal I/O repair remain. The newly found defect is a model timer enclosing a longer test phase, not evidence that all timeouts should disappear. |
| Work-authored fixes versus agent-authored patches | Keep attribution explicit. This repair is Work-authored platform code; it does not implement the phone-search product correction or claim autonomous publication. |
| Sandbox approvals later expanded | Standing permission covers qualified testing when ready; it does not make an unqualified environment safe. No real test VM or model request is necessary for this local repair. |
| Stronger Preview operational authority | Routine reviewed feature development is authorized. Exact release checks, no uncertain duplicate operations, credentials, Production separation and audit integrity remain meaningful. |
| Desire for fully independent agents | Discovery, general task admission and publication are positive capabilities still to build and qualify; deleting permission checks does not implement them. |

## Verified defects addressed together

1. **Acceptance handoff:** phone source scope advertised four static requirements while the actual Chief delegated one criterion. Model schema permitted 1–4 mappings but runtime required exactly one. A shared handoff now distinguishes task requirements from actual Chief criteria and derives mapping counts/indices from the latter.
2. **Incomplete planning:** the preserved Chief criterion ends with a dangling `≤`. New contracts reject objectively unfinished criteria before another model stage. Minor prose observations stay attached as advisory evidence; they no longer force every later Auditor to fail.
3. **Review handoff:** phone bypassed generic QA finding pinning. Shared schemas now bind every task's QA rows to its actual findings and evidence, and bind final reporting to prior QA values and the Auditor decision. Runtime still rejects duplicate, missing or reordered required evidence.
4. **Test outcome versus execution failure:** a known failed assertion previously stopped before review. Current native test jobs can return reviewable failed evidence only after full source identity, all isolation checks, protected integrity and verified cleanup. Unknown infrastructure, transport, authorization and cleanup failures still stop. Failed tests cannot become a backend technical pass.
5. **Nested deadlines:** the controller's 135-second model phase also enclosed a test operation allowed 300 seconds. Model and artifact/test phases now have separate deadlines bounded by the same original operation deadline; cancellation and cleanup remain mandatory.
6. **Completion versus accepted objective:** a complete five-stage run blocked another distinct attempt even when its Auditor rejected it. Current development continuation distinguishes preserved rejected/unresolved review from technical success, retaining fresh identities and exact source/release enrollment.
7. **Test harness coupling:** phone tests rewrote another test file's source to create a controller. Reusable explicit controller/provider helpers replace that mechanism for the repaired paths. Independently scripted responses vary criteria counts and reviewer disagreement; actual controller, CAS, parsing, data-copy worker and result codec remain in the test path.
8. **Serialization versus token limits:** schema-valid phone output measured 20,587 bytes against a 16,000-byte parser cap. Accumulated valid visible/phone reports exceeded the old 32 KiB request envelope; the richest tested phone final request is 54,956 admission bytes. One shared modern policy now permits 64 KiB requests, 32 KiB artifacts and 128 KiB provider envelopes. Historical limits are unchanged. Every modern implementation request uses exact provider counting before paid Responses dispatch, rather than treating serialized bytes as input tokens. Tests bind successful count proofs to all 15 rich profile/stage requests and reject cloned or cross-workspace proofs. Token ceilings and output budgets are unchanged. These measured ASCII cases do not establish that every possible Unicode/schema-maximal payload fits.

## Compatibility and evidence

New plans carry a server-authored `engineering-handoff-v2` marker inside their immutable runtime binding. It selects serialization and validation, never grants authority. Unknown markers are rejected. Historical contexts without a marker retain their original contracts. Historical Chief request hashes `63e491…`, `655e4c…` and `b3baf182…` remain regression anchors; the latest observed Chief receipt is retained as a fixture explicitly labeled historical.

New native test manifests select reviewable failed-assertion reporting explicitly. Historical manifests reconstruct the original commands and hashes for readback. No journal migration, history deletion, competing ledger, provider credential or orchestration layer is introduced.

All local provider and OS responses are explicit fixtures. Real disposable filesystem preparation does not execute the proposed source. Fixture success is not proof of live model compatibility or an accepted product correction.

## Remaining structural work, in practical order

1. Complete combined local and independent qualification, then perform one reviewed Preview release cycle. Do not run paid trials against an unqualified local tree.
2. Consolidate active task registration into one server-owned descriptor consumed by admission, model scope, patch validation and test-profile selection. Preserve historical descriptors as replay data. Current task routing still contains duplicated objective-string registrations; it is not yet general repository-wide task admission.
3. Replace deployment configuration used for per-task consent with reviewed release/task records in the existing journal. Today configuration still entails eight settings, refresh, three resets and dispatch/ack receipts. Keep duplicate-operation protection until a reviewed replacement exists; do not simply skip the lifecycle.
4. Measure and reduce whole-ledger read/CAS work on each authority renewal. Removing artificial storage caps did not eliminate provider request-size or latency constraints. Preserve the original audit payloads.
5. Reconcile slow provider shutdown durably. Sequential provider find/stop/read can exceed the current cleanup reserve; failure must remain unconfirmed rather than be reported as successful cleanup.
6. General discovery and reviewed agent-authored Preview delivery remain separate milestones. Internal agents currently have no direct repository publication capability. Production and PR #5 are unchanged.

## Preventing recurrence

Every changed contract must identify its producer, model schema, parser, persisted receipt, consumer, historical replay and failure path. Tests must exercise those components together with independently supplied responses and at least one task with multiple files/findings. Maintain one exact-source release qualification; do not repeat paid calls to debug deterministic schema disagreements. After two failed focused repairs, isolate the disagreement before widening scope or deploying again.

## Review and verification evidence

Independent Work QA and Engineering Auditor reviewed the shared runtime at fingerprint `2972d98778646450605f9cf4e07d00618f6478e1ea78e1e0d76e3b67e05731b0`, with no unresolved material security finding. Their role separation is technical review, not independent human/business acceptance. Rich fixture tests cover all five request/parser handoffs for Starter, visible-time and phone tasks with real disposable data-copy creation/destruction and no generated-code execution. Independent scripted phone controller runs exercise one, three and four actual Chief criteria and preserve Auditor rejection.

The first full local regression run is preserved: 5,153 tests, 5,129 passed and 24 failed. Failures exposed the modern request byte/token mismatch, six stale runtime fixtures, a stale timer-count expectation and two diagnostic/helper fixture mismatches. The affected 91-test rerun passed 90; its remaining timer expectation was corrected to verify the separate 300-second artifact/test phase inside the unchanged 585-second work deadline, and that case passed separately. These failures were not hidden. The final complete Node22 offline run passed **5,159/5,159**, zero failures/skips, in 710.444 seconds (`SHARED_WORKFLOW_FULL_FINAL.log`). Hosted Redis, CI, CodeQL, Jekyll and authenticated Browser qualification remain release requirements. Passing fixtures are not a live model success claim.

Final verification counts and exact local/release identities belong in `CALLERCORE_PROJECT_STATE.md`. A passing test or this review is not permission to describe the system as fully autonomous.
