# Detailed final Chief reporting and semantic stage completeness

Preview-only implementation; paid execution/new write permissions stay disabled. No live model request or pilot approval is authorized by this document. Historical screenshots, specialist findings, observations, QA, acceptance and accounting are unchanged.

## Why the previous preflight stopped

Published6be8d90 deliberately allowed only two aggregate final status sentences and supplied outcomes/acceptance/hashes without individual findings/verdicts. Existing tests correctly verified that limited protocol, but did not test its ability to fulfill the owner's richer final-report responsibility. The next preflight caught the requirements-to-capability gap before activation/transport. The frozen non-billable record in tests/fixtures/agent-operations-report/report-blocker-v1.json preserves this evidence; it is not described as a live provider response. Older Chief-revision and observation-response replays remain unchanged.

## Authoritative report contract

`chief-report-v2` is part of versioned shared `organization-contracts-v2`. Backend rebuilds verified claims from immutable original specialist findings, revalidates the sealed observation/adjudication hash chain and semantic grounding, validates original image/source/execution provenance, recomputes geometry conflicts, and binds the independent acceptance receipt. It projects each original finding and atom, exact QA decision/reason/probability/evidence/observation references/uncertainty, plus whole-task independent acceptance and its reason. The Chief receives the actual content, referenced observations, artifact hashes and geometry provenance, rather than hashes standing in for missing information.

The report distinguishes **model QA dispositions** (accepted/rejected/unresolved) from **whole-workflow independent acceptance** (accepted/not-accepted). A reject containing insufficient evidence is labelled unresolved while preserving `qaDecision=reject`. Model QA may accept an individual claim while the independent assessor rejects the overall task. Counts and canonical summary state both scopes explicitly. Chief has no authority to change either.

The model returns the detailed certified report unchanged. This supplies evidence-grounded explanations without unrestricted paraphrasing that could invert a verdict. Exact semantic equality ignores JSON property order; omissions, duplication, invented claims, changed reasons/uncertainties/decisions, foreign image or observation references and misleading overall status fail. No model-generated revision identifiers. Backend-generated snapshotHash binds workflow/scope/evidence/specialist/observation/QA/acceptance/geometry/outcomes. It is integrity, not permission or authentication.

Dispatch reconstructs the final request from authoritative state and compares the entire request hash, recording its snapshot on the reservation. Receipt and atomic finish revalidate against current authoritative data, in addition to existing task revision/fence/lease/grant/approval/cancellation guards. Transient heartbeats/diagnostic revisions do not change the immutable report basis; acceptance/evidence changes invalidate it. Concurrent completion settles once; replay, stale state and cancellation remain denied. Durable final result saves the report and authoritative binding; original QA records remain separate and unmodified.

Input stays within the existing32k-byte/32k-planning-token text envelope and24k-byte report limit; excessive certified content blocks before dispatch. Model, Medium reasoning,20koutput including reasoning,150secondsstage/10minutestotal,5calls/$3.60newholds/$15cumulative remain unchanged. No pricing/billing setting or credential change. Unsupported large reports are a fail-closed limitation, not an excuse to silently truncate required decisions.

## All five responsibilities verified before transport

| Stage | Required model-visible information | Rejected omissions/contamination |
| --- | --- | --- |
| Chief planning | Exact approved objective/Legal-Growth scope, verified state/history/task, budgets and explicit per-stage call/token/time/reservation limits | Missing budgets/limits, different scope, altered fixed developer policy |
| Specialist | Objective, actual Chief delegation, pinned scope, four hash/dimension-verified high-detail PNGs and available geometry/provenance | Missing delegation/objective/scope/image bytes/geometry field |
| Blind observation | Exactly one user text with allowlisted evidence metadata and four original PNGs | Conclusions at top level, inside evidence/images, extra input text or developer/assistant messages |
| Adjudication | Exact original claims/atoms, durably sealed independent observations, original PNGs and geometry/provenance | Missing/stale/altered seals or claim coverage, absent geometry, invalid images |
| Final Chief | All verified individual findings/verdicts/reasons/references/uncertainties plus authoritative independent acceptance | Old hashes-only protocol, missing decisions, invented or altered QA output |

`stage-capabilities-v1` checks responsibility data and exact native message boundaries in construction and provider preflight. It verifies canonical PNG base64 bytes/hashes/dimensions; image-shaped strings are insufficient. Shared schemas/instructions/envelopes remain independently checked. Release lock covers19 whole selected runtime/boundary/preflight sources plus existing functions/constants. Changing a release requires review, offline gates, exact-source CI/hosted checks and fresh paid authorization, never automatic lock repair during a pilot.

## Demonstrated offline detailed report

The complete native request-only mock runs all five stages for accepted, rejected, uncertain and mixed findings, with four real fixture PNGs, sealed observations, separately bound acceptance and durable final report. Synthetic provider replies see only outbound requests; scenario selection affects original specialist output only, not hidden QA answers or backend IDs.

| Original synthetic finding | QA decision / disposition | Preserved explanation and evidence |
| --- | --- | --- |
| Badge overlaps the price | Reject / rejected | Sealed observation identifies separate price; cites I3/O3 and exact QA region |
| A badge is visible | Accept / accepted | Visible badge supported by I3/O3; does not imply whole task accepted |
| Illustration is contextually appropriate for Legal | Reject / unresolved | Presence cannot establish suitability; cites I1/O1 with explicit missing-criteria uncertainty |

Final summary: **Model QA findings:1accepted,1rejected,1unresolved. Independent workflow acceptance:notaccepted.** This is an offline contract demonstration, not live vision accuracy or model inference evidence. Separate hostile finish tests reject altered verdicts/refs/omissions and preserve pending holds; stale/replay/concurrent/cancelled/changed-evidence/changed-assessment tests demonstrate backend admission protections.

## Verification and remaining limits

Canonical state records exact source, fingerprint, counts and remote evidence. Unit/native integration/frozen replay/request-only mock E2E establish implementation behavior. New live provider schema compliance and substantive image accuracy remain unverified. There is no new live response replay for the final stage. Exact report copying prevents Chief distortion; it cannot prove an underlying QA rationale is semantically true. Existing relevance screening remains heuristic and independent image acceptance remains mandatory. No new paid pilot is authorized.

| Capability | Unit | Integration | Contract replay | Mock E2E | Live | Production |
| --- | --- | --- | --- | --- | --- | --- |
| Detailed report/binding/atomic finish | Passed adversaries | Native receipt/backend and CAS tests | Frozen old incapable request; no live final response | Five-stage accepted/rejected/uncertain/mixed passed | Unverified | Unverified |
| Stage responsibility completeness | Passed omission/leak/byte/limits cases | Actual native requests for all five stages | Historical Chief/observation plus report blocker retained | Native request-only mocks passed | Unverified | Unverified |
| Recovery foundation | Seven offline test groups | Durable adapter absent | None | Offline fixture policy simulation only | Unverified | Unverified |

CI, Redis and hosted/browser checks establish their scoped implementation boundaries; exact IDs/results are recorded only after completion in the canonical handoff. The recovery simulation is not described as a running workflow or Redis-backed remediation service.

Autonomous recovery is separately documented in AGENT_OPERATIONS_RECOVERY.md: pure disabled planning/simulation foundation only, not a retry executor. Trusted review attestations, durable recovery adapters, permission grants, write executors, mobile loaded-data readiness and complete live workflow acceptance remain future work.
