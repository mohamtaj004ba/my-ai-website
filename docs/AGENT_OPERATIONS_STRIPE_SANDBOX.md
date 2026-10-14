# Stripe sandbox owner verification

## Implemented boundary

`agent-operations-stripe-sandbox.js` prepares a narrowly guarded **owner-only verification**, not an operational finance agent. It uses the existing authenticated Agent Operations API and workspace-owner policy, the existing operations connection/revocation journal, and existing atomic configuration/audit transaction helper. Its separate record stores only sanitized verification evidence and admission state; it is not a second authorization or spending system.

Preview-only `CALLERCORE_STRIPE_SANDBOX_RESTRICTED_KEY` is used server-side. Only an `rk_test_` restricted-key shape is accepted; live and unrestricted keys fail before transport. A key prefix alone does not prove identity or permission. The first actual request is fixed `GET https://api.stripe.com/v1/account`, and its provider-returned account ID must equal **acct_1To8TZFMvbBcKVZe**. No `Stripe-Account` header, caller-selected account, arbitrary URL, or external redirect is accepted.

After identity succeeds, the verifier performs exactly five fixed GETs, each with `limit=1`: Customers, Products, Prices, Invoices and Subscriptions. Every returned object must be sandbox `livemode=false` and match the requested resource type and list URL. It strips account names, customer names/emails/IDs, invoice amounts, metadata and every raw payload. The receipt contains only resource name, retrieved count zero or one, `hasMore`, exact account/source/Preview/release, timestamp and evidence hash. Counts are **first-page observations, not account totals**, and no billing/revenue report is claimed.

Only status, verify and local revoke controls are exposed through exact empty-input owner commands. There is no automatic verification on page load, model dispatch, internal-agent Stripe grant, draft invoice, payment, refund, subscription change or other mutation. CallerCore's historical internal testing ledger is not changed by these read-only checks.

## Permission prerequisite and honest failure

The owner reports a dedicated restricted sandbox key with five resource Reads: Customers, Products, Prices, Invoices and Subscriptions. Those permissions may not authorize `/v1/account`. If Stripe denies identity retrieval, the verifier stops before any resource request and records the fixed `account / provider-403` diagnostic. It must not infer the account from configuration, a submitted account ID or a requested header. No additional scope is automatically added. Any minimum extra account-identity read permission requires owner approval based on the actual provider denial; do not broaden to account-wide write or replace the key with an unrestricted key.

The adapter cannot introspect all restricted-key permissions and does not attempt a prohibited write to prove denial. It reports `providerKeyPermissions: owner-configured-not-introspected`. Provider-side key permission configuration remains distinct from CallerCore's GET-only enforcement.

## Enforcement and recovery

Before every provider request and receipt acceptance, fresh owner authorization and exact operations-journal revision/source/release/origin are checked. Changes, Emergency Stop, local Stripe revoke, Redis failure or foreign identity fail closed. After receipt storage, the actual operations journal and stored receipt are read again; a provider revocation racing final storage is returned as revoked, never as the old healthy snapshot. Existing provider local revocation is authoritative; it does not rotate, delete or revoke the actual Stripe key. Owner verification does not authorize other specialists or departments.

This is guard/read linearization plus atomic verification-record admission, not a claim that the operations journal and verification receipt are committed in one cross-record transaction. A read already transmitted before a concurrent revoke cannot be recalled, and a dated verification receipt may remain preserved after revocation. Fresh shared-journal checks gate subsequent requests and owner status; no receipt grants agent execution authority. Tests include the actual `operations.connectionsManage` provider-revocation path injected at final receipt storage.

Atomic admission allows one verifier per owner/workspace. No automatic retry or recurring job exists. The whole operation is bounded to twenty seconds, six GETs, 150KB per response and no pagination. Cancellation aborts transport and rejects late results; already-transmitted requests cannot be recalled. Interrupted running records remain blocked rather than silently reset; an owner can revoke them. This release intentionally has no automatic reconnect/restore after local Stripe revocation. A separately reviewed owner reauthorization path is required before re-enabling a revoked connection.

The UI waits twenty-five seconds, requires same-owner/workspace/source/release readback, and labels agent access and external writes disabled. It displays only sanitized evidence and finite failure category/phase/timing. Owner status is a dated observation, not continuous provider-health monitoring. The protected Secret is never copied into Redis, UI, prompts or test artifacts.

## Verification status

Targeted tests substitute only HTTP and Redis transport boundaries, exercising the real verifier, API routing and shipped UI. Coverage includes owner/worker/CSRF/Production denial, wrong sandbox/live object, missing account permission, bounded GETs, credential/PII stripping, stale source, CAS concurrency, revocation, cancellation, malformed responses and receipt tampering. Actual hosted verification remains pending until the reviewed code is published and the owner explicitly runs the supported verification control. No provider request was made during implementation.

## Official references

- [Restricted API keys](https://docs.stripe.com/keys/restricted-api-keys): resource-level Read/Write/None and preferred restricted agent credentials.
- [Retrieve your account](https://docs.stripe.com/api/accounts/retrieve): provider account identity.
- [API keys and sandbox/live modes](https://docs.stripe.com/keys): separation of sandbox and live credentials.
- [List customers](https://docs.stripe.com/api/customers/list), [products](https://docs.stripe.com/api/products/list), [prices](https://docs.stripe.com/api/prices/list), [invoices](https://docs.stripe.com/api/invoices/list), [subscriptions](https://docs.stripe.com/api/subscriptions/list).

Pinned Stripe API version: `2026-08-26.dahlia`, matching the installed Stripe best-practices guidance inspected for this implementation. No payment or subscription workflow is being activated, so payment fulfillment/webhook infrastructure is outside this read-only verification scope.
