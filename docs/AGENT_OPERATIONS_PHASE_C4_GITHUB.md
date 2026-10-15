# Phase C.4 GitHub App connection preparation

## Current status

`lib/agent-operations-github-app.js` is a reviewed-code prerequisite, **not a connected GitHub App**. There is no registered CallerCore-owned app, approved private-key store, live installation, credential broker, or gateway activation in this change. Existing public CI inspection remains separate and operational. No Work connector credential is used or copied. No provider request or installation-token mint occurred during validation.

The preparation adapter can perform two bounded operations after future trusted gateway admission: exact-commit parent metadata and CI status for that commit. Each read first verifies that the installation token sees exactly one repository, with the approved numeric ID and `mohamtaj004ba/my-ai-website` name. Inputs cannot select a URL, HTTP method, account, arbitrary branch, path, raw logs, or external mutation. Outputs contain only fixed identity/status fields, timestamps and integrity hashes. Repository names alone are insufficient: owner-approved installation and numeric repository identities are required.

## Exact owner-dependent setup

1. Approve registration of a dedicated GitHub App owned by the CallerCore business GitHub account or organization. Name and ownership must be confirmed by the owner. This code does not register an app or fabricate an installation URL.
2. For the owner-requested full-lifecycle **App registration**, prepare **Metadata: read-only** (automatic), **Contents: read and write**, **Pull requests: read and write**, **Issues: read and write**, and **Actions: read and write**. This is the App's potential provider scope, not an agent grant. Do not request Administration, Secrets, Workflows, organization/account permissions, webhooks, user OAuth, or all-repository installation. The initial minted installation token must still explicitly narrow to **Metadata/Contents/Actions: read-only**, exactly as `PERMISSIONS` and `tokenRequest` enforce. A token inheriting broader App permissions is rejected by the read adapter. Future mutations require separate guarded implementation and owner authorization; no existing code gains writes from registration.
3. Install the app using **Only select repositories → my-ai-website**. Record the actual App client ID, installation ID and numeric repository ID from provider-verified records. Do not trust query parameters or a human-entered repository name as proof of installation ownership.
4. Select an approved managed credential broker/key store with server-only access scoped to Preview. Store the GitHub App private key there, never in Redis, dashboard forms, model context, logs or this repository. A credential reference is an opaque lookup identity, not an implementation of encrypted storage.
5. Implement and independently review the broker binding. It signs a short-lived RS256 App JWT using the stored key, calls GitHub's installation access-token endpoint with the **explicit single repository ID** and **explicit read-only permissions**, validates actual returned installation/token metadata, and supplies the token only to the server adapter. This adapter does not itself sign JWTs or mint tokens. `jwtClaims` provides a bounded claim template, not an authentication method.
6. Bind connection identity and revocation to the existing owner/workspace/task/release Redis gateway. Its `authorize` callback must re-read durable authority, not return a constant or trust model-supplied state. Test real successful and denied paths before enabling private reads. The adapter performs authorization before broker access, before each GET and before returning a receipt; no separate permission system is created.

No additional paid subscription has been purchased. GitHub plan-specific API/rate constraints and any selected managed key-store cost must be established at provisioning. Repository write, branch creation, push, PR submission, merges, deployment and Production actions remain disabled.

## Registration descriptor and permission meaning

`docs/AGENT_OPERATIONS_GITHUB_APP_REGISTRATION.json` is a static owner-consent preparation descriptor, not a submitted manifest or working connection. Its `providerManifestFields` uses GitHub's documented manifest keys (`public`, `default_permissions`, `hook_attributes.active`, `default_events`, `request_oauth_on_install`). No homepage, callback, redirect or webhook URL is guessed. GitHub requires a homepage URL for registration; the owner must supply it. The unavailable-name check and actual owning account must also be confirmed. Prefer manual owner registration with webhook Active unchecked until a separately reviewed managed manifest handshake exists: manifest conversion returns private key material and must not be routed into model context or browser logs. The descriptor intentionally is **not submission-ready** and does not claim a full provider schema validation or successful registration.

The intended owner is the existing repository owner `mohamtaj004ba`; install the private App only into that account's selected `my-ai-website` repository. A private App owned by a different organization may not be installable into this personal account; confirm ownership before registration rather than making it public or expanding accounts silently.

**Actions write** permits workflow dispatch/rerun/cancel operations; it does not mean permission to edit `.github/workflows` files. No Workflows permission is requested. **Contents write** is broader than preparing commits: it can also create/delete refs and tags. **Pull requests write** can expose merge operations. Consequently App installation is not sufficient authorization for these actions. CallerCore keeps main, Production, workflow-file changes, merges, ref deletion, and all current mutation endpoints disabled. The Chief receives no App private key, broad installation token or authority to mint stronger tokens. Future brokers must expose separate reviewed operation contracts, not a caller-selected permissions map.

## Token lifecycle and limits

GitHub installation access tokens expire after one hour. The future broker must request minimum permissions and repository IDs rather than accept the App's full installation scope. Adapter tokens are not cached, persisted, returned to the owner UI or included in receipts. All requested permissions must match the narrow read-only set; unknown/write scopes or extra repositories fail closed. The broker must supply authenticated provider identity; supplied metadata is not independently trustworthy without the reviewed broker.

The adapter has a six-second total local deadline, cancellation, no redirects/retries, 250KB maximum JSON body and at most two GETs (repository identity and one requested read). Cancellation or local revocation cannot recall a transmitted request; late results are rejected. A stalled broker is locally interrupted and cannot subsequently trigger adapter dispatch. Broker-side token mint cancellation and cleanup remain responsibilities of the future broker; local interruption does not revoke an already minted token at GitHub. Provider installation deletion/repository removal and CallerCore local revocation are distinct controls.

Errors are fixed sanitized codes; provider messages, tokens and headers are not exposed. Treat all future repository text as untrusted evidence. These metadata-only responses do not establish semantic quality of an engineering proposal or independent review.

## Verification scope

`tests/agent-operations-github-app.test.js` exercises actual adapter control flow with only broker and HTTP boundaries substituted: exact transport/method, denied writes, credential scope, wrong installation/repository, additional accessible repositories, revocation before/during execution, cancellation, malicious raw errors, bounded response parsing and sanitized CI results. These are deterministic contract/security tests, **not evidence of a live private connection**.

## Official provider references

- [Generating an installation access token](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app): explicit repositories/permissions and one-hour expiration.
- [Authenticating as an installation](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app-installation): App authentication, installation token and API use.
- [Generating an App JWT](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-json-web-token-jwt-for-a-github-app): RS256, issuer and maximum ten-minute JWT expiration.
- [Registering an App from a manifest](https://docs.github.com/en/apps/sharing-github-apps/registering-a-github-app-from-a-manifest): provider manifest keys, required homepage and sensitive conversion handshake.
- [Registering an App](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/registering-a-github-app): manual registration and optional inactive webhook.

Reviewed against official documentation on 2026-10-14. Actual installation and broker access remain owner-dependent prerequisites.


## Finite timeout diagnostics (non-authorizing)

The existing six-second total read bound remains unchanged. A trusted in-memory observer records bounded authorization counts/timings and finite credential-read, installation, narrowed-token, repository and requested-read phases. Provider HTTP results use fixed classes only. Active phases at timeout remain explicitly incomplete; an unknown exception is not described as a confirmed provider failure.

Only errors created by the adapter carry a private WeakMap diagnostic receipt into the existing immutable interrupted-read audit. Provider-supplied properties cannot forge that receipt. No raw exception text, URLs, authorization headers, tokens, keys, request payloads, or provider bodies enter diagnostics. Successful model-visible evidence is unchanged. Late work cannot alter the sealed receipt; the internal signal is aborted on exit, and existing fresh authorization/central revocation still gates subsequent requests and completion.

Historical hosted timeout remains phase-unconfirmed. Nine serial authorization callbacks and four provider requests share the existing bound; latency contention is a hypothesis until a separately authorized attempt on this exact deployed source records its actual phase. No automatic retry or credential recreation is justified.
