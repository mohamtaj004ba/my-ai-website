# Organizational execution boundary correction

This Preview-only engineering pass addresses a confirmed missing operational process composition. Paid execution, customer changes, autonomous writes and Production remain disabled. Historical accounting and evidence are immutable.

## Pre-implementation risk analysis

The consequential boundaries are authenticated owner session → controller; controller → central Redis CAS approval/ledger; trusted driver → restricted child IPC; driver → protected browser capture; driver → OpenAI; and trusted independent acceptance → backend. Assets include credentials, screenshot provenance, independent decision authority, pending spending holds, release identity and cancellation state. An untrusted model or child must not manufacture any of these authorities. The direct-network guards supplement Node filesystem/process permissions; they are not an OS network sandbox. The parent executes tracked orchestration code only, never model-generated JavaScript.

Threats and failure interactions: reused or wrong-release grants; duplicate initialization/dispatch; capture outside approved routes; request mutation after reservation; child-forged acceptance; parent/controller disappearance; stale receipts after central revoke; provider response arriving after cancellation; a missing browser or acceptance callback discovered only after a paid call. Controls must reject each before consequential work, retain uncertain holds, terminate children, and preserve sanitized diagnostics without advancing failed workflows. A transmitted provider request cannot be recalled; Redis admission and remote provider receipt are not an atomic transaction.

## Actual dependency map

| Boundary | Implementation | Authority and dependency | Failure behavior / evidence requirement |
|---|---|---|---|
| Normal admin → owner Start | agent-operations-pilot-control.js → agent-operations-api.js | Existing session, member, workspace-owner, same-origin and Preview checks; exact configured selection | No authority issued by UI; lost session denies work; duplicate Start cannot duplicate consumption |
| Controller → ledger | node-controller.supervisePilot → organizationPort → organization/lifecycle | Exact task, source, release, scope, limits, expiry; central CAS consume/renew/revoke | 30-second lease fallback on controller loss; explicit committed revoke denies new boundaries immediately |
| Driver → restricted child | organizational-driver.cjs → organizational-child.cjs → remote-worker.runWorker | Fixed task-only IPC handles; no real secrets in child; permission-restricted process | Parent validates operations, actual stage, request hash, reservation and fresh central authority; terminate on error/abort/deadline |
| Child → trusted capture | runner → parent capture → agent-operations-capture.cjs | Pinned 8133597 Legal/pricing scope, four 1440/390×1000 PNGs, development OIDC, verified fonts, Playwright browser and evidence output | Capture-time geometry and artifact hashes; no identity delivered to browser/model; missing runtime must fail startup preflight |
| Child → provider boundary | organization-provider → parent transport → Responses API | Dedicated Agent Operations key/project, native shared request/schema validators, reservation, exact execution ID | Maximum five calls, 20k output, 150s/stage, 10min total; no retries; diagnostics/uncertain reservations survive failure |
| Chief → specialist | chief-intent-v2 + backend execution binding | Backend-owned revision/context/fence; no model revision ownership | Historical revision replay must fail before network |
| Evidence → observation | verifiedImages + blind DTO + organization.finish | Four exact PNG hashes and dimensions; no specialist claims in blind request | Durable seal before adjudication input can expose claims |
| Observation → adjudication | organization-qa + grounding | Immutable seal, exact claims/atoms and relevant image/region references | Unsupported/wrong-location decisions denied; structural validity is not substantive accuracy |
| QA → independent acceptance | parent independent-assessment → separate assessor capability | Image/hash integrity and capture-time deterministic measurements; general subjective claims require trusted review | Default withholding of acceptance; model agreement never substitutes independent acceptance |
| Acceptance → final Chief | chief-report-v2 + final-report.build/valid | Backend-certified per-finding decisions, uncertainty and whole-task outcome | Invented/omitted/altered decisions or evidence denied |
| Terminal/failure → shutdown | activation-controller + central revoke + owner readbacks | Current, historical and replacement brokers share central record | Revoked approvals cannot resume; no automatic retries; retain evidence and pending holds |

## Non-billable rehearsal acceptance

The same tracked child, IPC policy, request builder/parser, task state machine, Redis CAS ledger, screenshot capture, assessment and shutdown must execute. Only the provider-response boundary is replaced by fixed request-faithful synthetic responses. Rehearsal authority is immutable authorized=false/maxCalls=0/maxMicros=0, isolated from historical paid accounting and never accepted by the paid approval validator. Synthetic stage reservations are not provider charges. A synthetic responder is not evidence of live-model visual accuracy.

Required scenarios include accepted measurable claims, rejected, insufficient and mixed claims; missing runtime dependencies; startup/crash/provider failure; cancellation/expiry/revocation; stale release; partial initialization; interrupted controller/cleanup and late response diagnostics. Actual hosted evidence must be named separately from offline tests. No readiness claim is allowed from test totals alone.

## Tracked trusted invocation

The trusted host runs `agent-operations-organizational-launch.cjs --rehearsal <nonce> --origin <exact-READY-origin> --source <full-source-SHA>` only after the authenticated owner controller emits the matching nonce/release initialization-admitted receipt. A click or the initial public handoff record does not prove preparation/activation; launching in that earlier window fails closed. Do not retry initialization. Run the exported dependency check before owner Start; launch repeats it before worker initialization. The nonce is public correlation data, never authority. The owner supervisor waits at most 30 seconds for initialization, renews centrally, and revokes in its finally path. The actual parent loads only existing restricted worker/development Preview identities; it never impersonates the owner.

The separately authorized future operational invocation is the same tracked launcher with explicit `--pilot --origin <exact-READY-origin> --source <full-source-SHA>`. It selects native Responses transport in the trusted parent and still requires the exact existing owner-configured active approval, dedicated project credential and all runtime prerequisites. It cannot create, activate or renew authority. This command is implemented, not executed or live-verified in this development pass. Owner Start and external worker handoff are explicit operational dependencies; no scheduler or automatic paid startup is introduced.

Revocation-only capability is domain-separated HMAC over the complete approval hash and exact runtime using the existing restricted worker secret. The backend installs only its hash at preparation; the parent can derive it before initialization. It is never provided to the child and cannot authorize work. Lost initialization responses and dependency failures therefore do not depend on receiving an initialization capability to request revocation. Unavailable storage/transport still means unconfirmed cleanup and no further work, not a successful shutdown claim.

## Rollback and remaining limitations

Keep paid disabled, revoke each harmless rehearsal centrally, terminate its parent/child and verify old/current/replacement readbacks. Revert only this feature's source if needed; never reset unrelated work or historical ledger. Trusted general reviewer attestations, monitoring, mobile readiness, autonomous writes and future department agents remain separate capabilities. General industry suitability cannot be established from screenshot agreement or a deterministic price-spacing check.

## Hosted diagnostic evidence boundary

The resumed56e rehearsal reached adjudication after four fresh captures and sealed observations but did not complete; a409 followed task lease expiry, with no retained initiating command. Exact request/receipt reconstruction passed offline and cannot establish successful remote state mutation. New bounded controller failure receipts preserve phase/status/code/timing and distinguish worker initialization deadline, lease expiry and stall without raw exception payloads. Parent broker events include fixed action/command names, timestamps and elapsed time. These are diagnostic controls, not relaxed authority or retry rules. Full hosted completion remains a separate mandatory gate.
