# CallerCore Environment Scope Matrix

Updated: 2026-09-21

This is the required environment-variable scoping posture for CallerCore. Values must never be committed to the repository. This document records names and intended environments only.

| Variable / group | Production | Preview | Notes |
| --- | --- | --- | --- |
| KV / Redis persistence credentials | Yes | Yes, but **separate Preview store preferred** | Never point destructive Preview tests at production customer data. Preview KV connectivity is still awaiting runtime verification. |
| `SITE_URL` | `https://www.callercore.com` | Preview URL behavior / omit when request-origin logic is sufficient | Do not make preview callbacks silently target production. |
| `CALLERCORE_CHECKOUT_ENABLED` | Unset/false until explicit sales-open approval | Unset/false | Must be exactly `true` to open checkout. Do not enable in Preview with live Stripe credentials. |
| `STRIPE_SECRET_KEY` | Live key | Test key only if Preview billing tests are enabled | Live Stripe secret should not be required in Preview. |
| `STRIPE_PUBLISHABLE_KEY` | Live key | Matching test publishable key | Keep mode paired with secret key. |
| `STRIPE_WEBHOOK_SECRET` | Production endpoint secret | Preview/test endpoint secret if used | Never reuse a webhook secret for a different endpoint unintentionally. |
| Stripe Price IDs | Live IDs | Test IDs if Preview Checkout is exercised | Do not mix live/test catalog IDs. |
| `MAILGUN_API_KEY` | Yes | Allowed when Preview email testing is required | Preview sends should be limited to controlled/test recipients operationally. |
| `MAILGUN_DOMAIN` | `notify.callercore.com` | `notify.callercore.com` when Preview mail is used | Verified active Mailgun sending domain. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Yes for admin Gmail | Prefer Production only unless a Preview callback is deliberately registered | Gmail remains admin-only at launch. |
| `CALLERCORE_ENCRYPTION_KEY` | Yes | Separate Preview key preferred | At least 32 characters. Rotating it invalidates ability to decrypt previously stored OAuth tokens. |
| `ANTHROPIC_API_KEY` | Yes | Yes when Preview AI/onboarding tests are needed | Cost-bearing; keep public endpoints rate limited/fail-closed. |
| `DEMO_TOKEN_SECRET` | Yes | Separate Preview value preferred | No source fallback. |
| `DEMO_PHONE_NUMBER` / display value | Production demo number when ready | Test/demo number only | Do not route Preview UI to an unintended live customer number. |
| `CALLERCORE_BOOTSTRAP_SECRET` | **No** | **Preview only** | Bootstrap handler also rejects non-`.vercel.app` hosts. |
| `VERCEL_ALERT_WEBHOOK_SECRET` | Yes, must match production webhook | Only if a separate Preview webhook deliberately exists | Do not assume Production and Preview generated secrets are interchangeable. |
| `SUPPORT_EMAIL` / `MAILGUN_FROM` | Yes/optional | Allowed | Customer mail must continue to expose support@callercore.com as a support path. |

## Launch verification

Before production merge:
1. Confirm `CALLERCORE_BOOTSTRAP_SECRET` is Preview-only.
2. Confirm Preview does not use live Stripe credentials or live Price IDs for test checkout.
3. Confirm Production `CALLERCORE_CHECKOUT_ENABLED` is still unset/false.
4. Confirm Preview KV is separate from Production KV before disposable-client destructive testing.
5. Confirm Production Mailgun domain is `notify.callercore.com`.
6. Confirm production Gmail encryption key is strong and stable.
7. Confirm the production Vercel alert webhook secret matches the configured production webhook.
8. Record any intentional Production+Preview shared secret and why it is safe.

## Rule

Environment separation is a data-safety boundary. Preview must never be able to modify real customer billing or destructively test against production customer data merely because the application code is otherwise protected.
