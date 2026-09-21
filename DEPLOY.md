# CallerCore deployment and release guide

Updated: 2026-09-21

This repository now contains the public CallerCore site, client dashboard, admin operations dashboard, Smart Onboarding, Stripe/Mailgun/Gmail integrations, website analytics, support tooling, notifications, agreement generation, and related Vercel Functions.

Do **not** treat this as a simple static-site deploy. The current feature branch represents a substantial product release.

## Release branch

Current development branch:
`feature/callercore-dashboards`

Production branch:
`main`

Do not merge the feature branch to `main` until the production-readiness gates in `docs/PRODUCTION_READINESS.md` are satisfied and TJ explicitly approves the production release.

## Automated checks

Run:

```bash
npm ci
npm test
```

Vercel deployments also run the critical-path test suite through the package build command.

GitHub Actions runs the same tests on pushes to `main` and `feature/callercore-dashboards`, and on pull requests targeting `main`.

## Required / expected environment variables

The exact set depends on enabled features. Never commit secrets to the repository.

### Core persistence
Vercel / Upstash KV variables such as:
- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`
- related Redis/KV connection variables injected by the connected store

### Site
- `SITE_URL` — production should be `https://www.callercore.com`

### Mailgun
- `MAILGUN_API_KEY`
- `MAILGUN_DOMAIN`
- optional `MAILGUN_FROM`
- optional `SUPPORT_EMAIL`

### Stripe
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

Webhook endpoint:
`https://www.callercore.com/api/stripe-webhook`

Subscribe the endpoint to the events CallerCore handles:
- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`
- `invoice.paid`

The webhook verifies Stripe signatures and deduplicates event IDs.

### Google / Gmail
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `CALLERCORE_ENCRYPTION_KEY`

Production OAuth callback:
`https://www.callercore.com/api/google-oauth-callback`

Gmail refresh/access tokens are encrypted before being stored.

### Smart Onboarding
- `ANTHROPIC_API_KEY`

Used for website extraction and conservative first-draft agent configuration. Onboarding falls back to deterministic configuration when the model call is unavailable.

### Preview bootstrap
- `CALLERCORE_BOOTSTRAP_SECRET`

Keep this preview-scoped wherever possible. The bootstrap endpoint refuses non-Vercel preview hosts.

### Voice
- Vapi credentials are not yet part of the completed production core. Configure them only during the dedicated voice-engine implementation session.

## Stripe checkout → managed onboarding

The expected customer lifecycle is now:

1. Checkout succeeds.
2. Stripe webhook creates/updates the CallerCore workspace.
3. Client receives a branded payment-confirmation email.
4. Account enters a two-business-hour managed review hold.
5. Admin reviews and clicks **Approve & send onboarding**.
6. Client receives the secure onboarding link.
7. Client signs the versioned Service Agreement.
8. Client completes Smart Onboarding / website scan / intake.
9. CallerCore creates the initial business profile, location, routing request, and agent draft.
10. Client receives an intake-received confirmation.
11. Build enters a one-business-hour QA hold.
12. Admin approves the build.
13. Test stage, client approval, and final launch follow.
14. Live confirmation is sent only when the account is actually marked Live.

Business-hour holds currently use Monday-Friday, 9 AM-5 PM Pacific.

## Agreement behavior

Agreement terms live in:
`api/_lib/agreement-clauses.js`

New signatures freeze:
- agreement version
- effective date
- exact clauses
- signer name
- signing timestamp
- selected-plan snapshot

Signed PDFs are regenerated from the stored snapshot so later agreement edits do not change historical contracts.

## Email behavior

Customer-facing auth and lifecycle messages use the shared branded system in:
`lib/email-template.js`

Lifecycle emails include support/contact paths by default.

Mailgun helpers set a Reply-To address so customers can reply normally.

## Security notes

Current controls include:
- Stripe webhook signature verification
- webhook event idempotency
- HttpOnly / SameSite sessions
- session-version revocation
- admin role checks
- workspace/tenant authorization
- same-origin rejection for account POST mutations
- encrypted Gmail OAuth tokens
- SSRF protections in Smart Onboarding website scanning
- CSP / HSTS / frame / MIME / referrer headers
- preview bootstrap secret + preview-host restriction

A focused security review is still required before broad production launch.

## Production smoke test

Before merging to production, run one disposable client through the entire path:

1. Get Started form
2. Stripe test checkout
3. payment confirmation
4. Admin review hold
5. onboarding invite
6. agreement signing
7. signed PDF delivery
8. website scan
9. intake autosave / resume
10. final intake submission
11. generated workspace/agent/routing data
12. Admin QA approval
13. test-call stage
14. client approval
15. Live activation
16. client dashboard access
17. support request
18. billing lifecycle event

When Vapi is implemented, extend this smoke test through a real test call, transcript, recording, lead creation, usage aggregation, and analytics.

## Related documents

- `docs/PRODUCTION_READINESS.md`
- `docs/TJ_DECISION_BACKLOG.md`

These are the current sources of truth for remaining release work and owner-authorized decisions.
