# Proactive engineering assessment

Status: corrected implementation and hosted owner-control verification complete, with explicit residual limitations. Non-billable Preview only. Prior verified framework and historical evidence remain authoritative.

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

## Verified hosted control evidence and readiness

Published security fixes f566f89 and70458be; verification-only CI correction933d6e0. Exact execution fingerprint remains organization-contracts-v3 /c194a01ef23461484ec23670713c75997f79d5f33d6e8935b3f09361bff377c2. The CI-only change does not modify this execution bundle.

The initial48 owner-session events remain in an unchanged downloaded artifact (SHA25648e57fcfa13386649d29dd3044acff961bdfbfce0892f105ec7fe540dd5dfb45). A separate10-event artifact records the final fixed-expiry denial and all8 revoked readbacks. No cookies, credentials or usable paid approvals are exported. Actual shared lifecycle/CAS runs on isolated zero-call/zero-budget records; operational tasks, holds and historical images remain unchanged.

Real BrowserWorker renewals every10seconds were acknowledged. Replacement deployment committed revocation at18:54:08.825UTC; original deployment denied control at18:54:32.897, before its18:54:33.750 lease deadline. This proves central revocation rather than lease expiry caused denial. Hard Worker termination at18:54:40.658 sent no revoke: control still valid18:54:42.136, then invalid18:55:27.917 after18:55:09.460 deadline. Thus termination is not instantaneous revocation; next admission after lease expiry denies, while committed revocation denies subsequent admission immediately. Already admitted or transmitted provider work cannot be recalled.

Lost prepare/activation responses and read/CAS faults fail closed and trigger owner cleanup. These are isolated adapter injections, not an actual Upstash outage. The browser activation/revocation sequence was ordered, not proven concurrent HTTP overlap; dispatch/revoke/cancellation races are verified in deterministic in-memory tests, while four real Redis cases cover concurrent creation/claims/grants/activation and sequential cancellation/revocation/probe flows. Slot7 activation after its fixed19:07:16.932 deadline failed409 at19:07:51.957, followed by revoke200; generic API failure text does not itself identify expiration, so attribution also uses preserved deadline and validator path. All8 records read back revoked.

Temporary inert verification configuration removed19:08:51UTC. Replacement deployment has only baseline Preview settings; original immutable verification deployments retain only their finite inert window until20:08:23UTC, never paid authority. Every created probe record is revoked. Original and replacement paid brokers independently reportfalse. Old pre-lifecycle binaries remain disabled/expired and cannot be retrofitted.

| Dimension | Evidence and limit |
| --- | --- |
| Unit / adversarial | 2,202 full local tests; lease, cancellation, stale state, replay, missing authority, spending, malformed contracts and new diagnostics/capture drift |
| Integration | Four real disposable Redis tests, actual API owner/worker boundaries, provider mocklate200/400 receipt preservation |
| Contract replay |126 mandatory checks include historicalrevision, observation and final-report blockers |
| Mock end to end | Request-faithful five-stage delegation, seal, adjudication, final report and independent acceptance; no hidden correct values |
| Hosted control | Real owner session, BrowserWorker acknowledgments/termination, two immutable deployments, revocation, fixed expiry and cleanup |
| Live five-stage provider workflow | Still unverified end to end; no new paid calls in this pass |
| Production / autonomous writes | Not activated or accepted |

Both independent reviewers challenged actual code and downloaded evidence. They found and verified late-diagnostic loss, capture fingerprint omissions, BlobWorker transport failure, and corrected an overstated hosted-concurrency claim. Reviewer declarations remain trusted development evidence, not independently authenticated product attestations.

## Next implementation order

1. Before a separately authorized read-only pilot: fresh exact-source, financial and contract preflight; prove the real trusted Node owner-controller adapter and bounded cleanup. Keep one workflow serialized; no other ledger mutations during Chief snapshots.
2. Before unattended or write authority: distinct authenticated reviewer attestations; operational monitoring and alerts; capacity-aware immutable archival; dependency-scoped versions; measured clock-skew policy; least-privilege branch/write grants and tested rollback.
3. Address mobile loaded-data readiness and combined dashboard accounting before treating the admin center as operational financial truth.
4. Bound provider response bytes before broadening provider inputs or sustained operations.

Four logical departments and future Engineering Auditor remain roadmap roles. No department lead calls, autonomous recovery, paid retries, monitoring adapter or write executor has been activated. See the16-entry failure-mode register for severity, evidence, recovery and acceptance criteria. A bounded read-only pilot is conditionally justified after all fresh prerequisites, not authorized by this assessment and not proof of autonomous readiness.

Final browser evidence:933d6e0 /38296134780 passed; artifact11769235274 SHA25675ac766130e90f21f7e719ba57e64be8641acdeb9a7955a59391af5a4516e322 independently downloaded/hashmatched. Actual551PNGs/502checks/287layouts/196readability checks, no console/page/API/visual failures,6comparisonsok. Desktoplegacytasks load/paidfalse; mobile still refreshframe. Voice/billing are fixtures, not realcustomer/provider acceptance. Final19:24readback covers5disabledbrokers.

### C.4 owner Vercel OAuth boundary — new verification increment

Credential and scope risk remains high until actual provider consent metadata is verified. Existing owner API/CSRF and Redis CAS now enforce exact owner/workspace/source/release/origin and single-use expiring state; no competing authorization system. Fixed endpoints, bounded exchange, encrypted tenant-bound storage and per-boundary owner/revocation checks mitigate substitution, replay and late-store races. Operational token broker throws scope-semantics-unverified, all external writes disabled. Authenticated installation/project metadata and token format remain provider-dependent evidence gaps. Failure may leave provider installation but cannot grant internal agent authority; owner uninstall remains separate. Local revoke is not provider-side token recall. Independent Auditor/QA reviewed source, additional real Redis race test added; hosted consent remains unverified until owner completes registration. No change to historical sixteen-item severity/acceptance claims or paid accounting.

### C.4 private provider consent topology — confirmed High blocker

Public consent entry generated404 for owner-created Private integration; no provider installation or exchange. Detection gap: API/mock tests accepted a mutually consistent URL without validating visibility-specific provider navigation. Exact actual private Dashboard entry now pinned in backend/UI and regressed against historical public/foreign-team/app/query substitutions. Original fresh nonce/state/CAS/owner/expiry/release/redirect/project restrictions untouched. Failed state revoked, provider wizard inspection cancelled. Remaining High: privatewizard nonce propagation is unverified until actual owner callback; if missing, deny before exchange, never infer/synthesize state. Real owner authority and scope must be checked, exact selected project only, all agent writes/paid dispatch disabled. Existing16riskregister items and historical acceptance remain intact.
