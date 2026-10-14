> Latest owner checkpoint: the private integration has now been created successfully. Client credentials are not yet confirmed configured; owner secret entry is pending. CI, CodeQL, real Redis and authenticated BrowserQA38641848852 attempt2 passed on03dc201. Provider authentication/installation remains unverified and operational agent broker/writes remain disabled.

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
