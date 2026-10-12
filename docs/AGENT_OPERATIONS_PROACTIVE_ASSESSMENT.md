# Proactive engineering assessment

Status: in progress, non-billable Preview only. Prior verified framework and historical evidence remain authoritative.

Pre-implementation risk: critical authorization verification changes may accidentally create paid authority, permit an owner bypass, expose secrets, modify operational ledger or confuse simulated outages with actual Redis failure. Mitigations: existing owner/session/admin/same-origin checks, explicit paidfalse gate, isolated server-selected probe ledger, zero-call/zero-budget/unauthorized production-incompatible profile, shared actual lifecycle/CAS primitives and no provider dependencies; strict fault seam limited to probe adapter. No paid approval/env or real operational mutation.

Threat boundaries: owner browser/session -> protected Preview API -> isolated control probe ledger versus authoritative operational ledger; trusted parent -> provider versus diagnostic receipt sink; model outputs -> schema/semantic validators -> independent assessment -> backend acceptedWork.

Confirmed defects to correct: late provider diagnostics lost after revocation; trusted capture/access/geometry sources omitted from fingerprint. Existing Chief global revision conflicts, finite ledger capacity, trusted-parent assessor identity and absent monitoring are restricted/planned rather than rewritten.

Independent reviewers: separate Engineering Auditor and QA; implementation alone cannot establish acceptance. Hosted storage fault injection is simulated adapter failure, never called a real Redis outage. Hard controller kill cannot run finally;30second lease limits control admission but does not recall already transmitted requests.

## Actual architecture and data flows

Owner session (hashed-at-rest cc_session) -> auth.getSession -> active internal admin membership/workspace-owner and same-origin checks -> protected Vercel Preview broker. Team/device OIDC passes deployment protection only; it is not CallerCore owner authority. Worker bearer -> task-bound worker capability; separate capture/assessor capabilities; no model sees credentials. API Production gate returns503 before loading storage. kv.js requires isolated Preview Upstash credentials and never falls back to Production.

Trusted parent -> approved fresh release/model/project configuration -> lifecycle prepare/activate/lease -> Redis-CAS operational ledger -> one task/grant -> claim/fence/reserve -> per-dispatch authorization -> Responses API. Provider input and image bytes remain in trustedparent; restricted child permission tests cover privatefiles/spawn. No model-selected shell/browser/tool actions. capture.cjs uses protected exactPreview route allowlist and canonical font resources; geometry distinguishes new reproduction from originalcapture.

Five stages: Chief intent-v2 delegates only role/reason under backendrevisionbinding; specialist receives fourverifiedPNGs and delegation; blindreview receives images without claims, observations durablysealed; adjudicator receives originalclaims+sealedobservations+images/geometry; separateassessor authoritatively accepts/rejects; finalChief report-v2 must reproduce certified individualdispositions/evidence/uncertainty and truthfulwholetaskstatus. Structuralvalidation, evidenceintegrity, substantiveaccuracy and finalacceptance are distinct. Assessor is currentlytrustedparent callback, not independently authenticated productionservice.

Redis ledger agentops:{preview}:v1:ledger atomically holds organization tasks/grants/approvals/reservations/audits and historical standalone records. Internalbudget retains ceilingholds evenaftersettlement; uncertainhistorical usage neverreleasedbythispass. Late diagnostic-only receipts append facts without status, acceptance or spendingauthority. Historical task/evidence records remain immutable except explicit separatelymarked new receipts for known dispatched executions.

Deployment topology: Git featurebranch and immutableVercelPreviews share isolatedPreviewRedis; exactimmutableorigin/SHA/release binds activation; stablefeaturealias is navigation only. Originalpre-lifecycle binaries stay expired/disabled. Disabledreplacement alone cannot revoke; centralregistry does. Registry readfailure deniesadmission. Faultinjection is limited to inertprobe adapter and labeledsimulated, never disrupts sharedRedis.

External dependencies: OpenAI model/project/price and API semantics; protectedVercel identity/config/build/status; Upstash atomicstorage; GitHub CI/CodeQL/browserartifacts; Node/Playwright/Chromium/fonts; owner session/membership; trustedparent process/network. Each dependency requires explicitfailureclassification and conservative usageuncertainty. CI results cannot prove providercompliance, visualtruth or Production acceptance.

## Distributed failure model and restrictions

Redis CAS is dispatch admission linearization point. Revocation committed first forbidsnewadmission; admitted/transmitted requests cannot be recalled. Owner lease30seconds renewableevery10seconds; graceful termination mustrevoke, hardkill losesfinally and forbidsnewcontrol afterlease expiry. No worker canrenewownerlease. An outage preventsconfirmation: never report shutdownsuccessful until durable revoke andreadbacks recover. Controller partialprepare/activation uses persisted owner-selectedID and tombstone forlostresponses.

Current Chief uses global revision; singlepilot mustbe serialized with nootherledger mutations during in-flightChief. This is an explicit operational restriction, not a backendparallelism guarantee. Future dependency-scoped versions must preserve stale/replay/cancellation checks. Recovery foundations remain offline planning/unimported: no automaticpaidretry, writeexecutor or permission expansion.

Risk register: AGENT_OPERATIONS_FAILURE_MODES.json contains evidence, existingcontrol, gaps, detection, recovery and measurableacceptance for each materialrisk. No unconditionalreadiness, no speculativecritical finding. ProductEngineeringAuditor, logicaldepartment leads, monitoringadapters and autonomouswrites remainfuturecapabilities.

## Permanent prevention gate

Existing riskclassification and contractpreflight remain foundation. For new critical commits after68d1966, engineering-quality-preflight now additionally requires change-bound proactiveReview evidence for architecture, dependencies, threats, failuremodes, faultinjection, independentchallenge, recovery and readiness. It rejects legacy checklist-only plans for new critical changes; prior verified history is not retroactively rewritten. CI and live-readiness already invoke this mandatorygate. New policy regressions remove eachdimension and prove preflightdenial. Presence/sourcebinding does not authenticate reviewerattestations or infer liveacceptance.

The release lock now includes actual capture/access/geometryhelpers, geometryrelations, diagnostic/probe/page code, dependency manifests and engineering/livepreflight sources. Fontbytes/CSS are checked against the fingerprintedmanifest by preview-access; no externalfontcontent is trusted without its recordedhash. Deliberate drift tests prove incompatiblehelpers fail beforemodeltransport. No modelcontract was weakened.

Late diagnostic receipts use a separate1MBcap, leaving1.01MB emergencyrevocationheadroom. Atfullledger, this bounded10k extra diagnosticspace cannot guarantee everyreceipt under allfailures; excesswrite fails explicitly and provider exception remains available to trustedparent. Per-dispatch reserved diagnosticcapacity and operationalalerts are required before sustained unattendedoperations. No historicalhold is released by receipts.
