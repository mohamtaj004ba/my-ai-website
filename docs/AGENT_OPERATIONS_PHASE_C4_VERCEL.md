## Vercel read activation candidate — October 14, 2026

Existing encrypted owner OAuth now has a narrowly scoped task-bound broker and current-deployment GET path in the existing gateway. Independent Auditor and QA inspected the actual implementation; confirmed deadline and audit-provider gaps were corrected. Guarded owner HTTP, real journal/broker/adapter composition, UI clicks, replay, revocation and emergency-stop tests pass with substituted provider responses. This candidate is not yet deployed or hosted-verified. Internal lease deadline is distinct from unknown provider expiry. Production/write/model permissions remain disabled. Mandatory STRICT, Redis, CI/CodeQL and exact-release hosted read/cleanup remain required. Separate OAuth and Ops records do not provide a linearizable cross-record cancellation transaction; already-completed read evidence may race with a later revoke.

> Latest verified continuation, 2026-10-14: existing private integration genuinely completed owner OAuth and fixed project verification. Revision5, configurationicfg_GGSQXkNuda6GuMLYb9vgA3aZ, only CallerCore project/team, actual scopes read:integration-configuration/read-write:deployment/read:project. Encrypted token retained; provider expiry unknown. Agent broker and every external write remain disabled. No repeated consent or credential recreation is needed for the current read grant. The original implementation checkpoint below is historical.

Remaining activation work uses the existing gateway: a short internal task-bounded credential lease distinct from provider expiry; fresh fixed configuration verification; exact immutable deployment binding before transport; provider-aware admission/revocation across both OAuth and operational stores; strict Vercel evidence validation. Existing generic gateway assumes GitHub in several guards and must not be enabled by adding a tool name alone. Preview target may be null; reject Production and validate exact project/source/branch/origin rather than requiring a fabricated target value. Auditor plan is preserved in local continuation evidence. No operational agent access claimed yet.

# C.4 Vercel owner OAuth connection

Owner-only Preview implementation, not yet authenticated with the provider. Work's Vercel connection is never inherited by CallerCore agents.

## Existing gateway and storage

The existing authenticated Agent Operations API exposes fixed owner-only status, begin and local-revoke actions. The callback uses the existing fresh workspace-owner policy and Redis compare-and-audit transactions. Ten-minute single-use state binds owner, workspace, exact source, release fingerprint and immutable deployment. Consent must begin on the feature alias, retaining its host-only owner session.

The server exchanges a code once at Vercel's fixed OAuth endpoint, verifies the actual installation, selected project and team, and performs a genuine fixed project GET. Each provider boundary freshly checks owner and durable state. Concurrent callbacks, replay, stale source, revocation and unavailable storage fail closed. Failed exchanges preserve only finite phase, HTTP category and elapsed timing.

Tokens are encrypted with AES-256-GCM using existing CALLERCORE_ENCRYPTION_KEY storage architecture, authenticated to owner/workspace/provider/Preview/configuration. No key, token, authorization code or raw provider response enters UI diagnostics, model context or audit records. Local revoke destroys usable local credential/state; provider uninstall is a separate owner action. Already transmitted provider requests cannot be recalled.

## Owner registration

Private integration: CallerCore Agent Operations; slug callercore-agent-operations. Individual developer Tj Mohammed, contact tj@callercore.com, public support support@callercore.com. Selected team team_6Rg3DdCrvOml6oEGwx6Ndf1I and only project prj_AkD7VoSNCE6fRYXQnXkX1ywGqjLX. Request only Integration Configuration Read, Projects Read and Deployments Read/Write for future separately authorized engineering actions. No environment, secrets, billing, domain, user or team administration scopes.

Callback: https://my-ai-website-git-feature-caller-d75cb2-mohamtaj004bas-projects.vercel.app/api/vercel-oauth-callback

After the reviewed callback is deployed, the owner completes registration and stores CALLERCORE_VERCEL_CLIENT_ID and secret CALLERCORE_VERCEL_CLIENT_SECRET in Vercel Preview, feature/callercore-dashboards only. Never paste credentials into chat. A necessary configuration deployment activates those settings. Then initiate consent from the existing authenticated dashboard, choose only the CallerCore project and complete owner consent.

## Authority and remaining evidence

Provider deployment-write permissions are not agent execution grants and may cover deletion or Production within the project. All CallerCore external writes and operational credential-broker access remain disabled. Actual provider scope serialization must be observed and independently verified before any operational tool use; identity-verified-scope-unconfirmed explicitly reports that restriction. Token expiry is not invented. The callback's authenticated project receipt proves identity/read access only, not Preview mutation authority.

Independent Auditor and QA reviewed actual source; focused owner QA9/9 and Auditor5/5 passed. Combined84 checks passed before final diagnostic-prototype and consent-refresh regressions. Real Redis OAuth race coverage was added to the existing integration suite; full STRICT CI, CodeQL and hosted authentication remain required. No provider registration, consent, credentials, paid calls or new spending reservations were created by these tests.

## Safe recovery

Never retry an uncertain code exchange automatically. Inspect finite failure metadata; start new owner consent only after its cause is understood. Revocation cannot resurrect a consumed state. A provider installation may remain after a failed exchange and require owner removal. Keep paid execution disabled, preserve original audit records and historical accounting.

## Private visibility consent entry correction

The public /integrations/:slug/new path was tested hosted and returns404 for this Private integration, including the owner. The supported-on-screen private Dashboard path is https://vercel.com/mohamtaj004bas-projects/~/integrations/callercore-agent-operations and its Connect Account wizard exposes expected project selection and permissions. Backend construction and UI exactpath guard now use that fixed team path with only fresh state. No visibility/scope/client/redirect change or duplicate integration. Original failed pending consent was revoked; inspection wizard cancelled.

The former mocks agreed on the public route and never tested Private provider-page availability; exact private path and historical-public-route rejection now regress that detection gap. Mock callback tests cannot prove provider UI state forwarding. Actual nonce-preserving callback and project read remain mandatory before calling the connection verified. If state is absent, stop failclosed and retain cleanup evidence. Never synthesize expected state or manually bypass the guarded link.
