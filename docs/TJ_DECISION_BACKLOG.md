# TJ / CallerCore Decision Backlog

Updated: 2026-09-21

These items are intentionally deferred because they require owner authorization, credentials, commercial decisions, vendor choices, legal review, or dedicated implementation time.

## Dedicated implementation sessions

### Vapi / voice engine
Requires a focused session:
- Vapi credentials
- assistant architecture
- phone-number provisioning
- webhook setup
- call event mapping
- recordings/transcripts
- transfers
- voice cost tracking
- test-call lifecycle

### Calendar
Decide:
- Google Calendar only vs provider-agnostic scheduling
- account ownership model
- booking rules
- buffers
- reschedule/cancel rules

### SMS
Decide/provider setup:
- SMS provider / number strategy
- opt-in model
- STOP/HELP handling
- missed-call recovery rules
- appointment reminders
- carrier registration

## Commercial decisions

### Minute overages

Decision memo: `docs/VOICE_UNIT_ECONOMICS.md`

Starter: 300 included minutes.
Growth: 600 included minutes.
Pro: high-volume plan; public unlimited-minutes claim removed pending policy.

Need to decide:
- whether Starter/Growth have overage billing
- exact overage rate (current provider economics support considering roughly $0.25-$0.30/min, but owner approval is still required)
- soft vs hard limits
- customer/admin usage warnings are already implemented at 70%, 85%, and 100% without implying an overage charge
- Pro usage allowance/fair-use language

### Unit economics
Need actual provider pricing/usage assumptions for:
- Vapi
- model inference
- telephony
- phone numbers
- SMS
- email
- hosting/database
- Stripe fees
- onboarding/support labor

From that, calculate gross margin by plan and stress-test Pro usage.

### Support promise
Current client-facing language says requests are reviewed during normal business hours, Monday-Friday, 9 AM-5 PM Pacific.

Decide later whether to offer:
- response-time targets
- priority support for Pro
- emergency/on-call support
- weekend coverage

## Legal / compliance authorization

- Washington technology/business attorney review of Service Agreement v2.0.
- Privacy Policy review.
- Terms review.
- Recording-consent policy.
- SMS/TCPA operating policy.

## Vendor / production credentials

- Production Stripe credentials and webhook validation if not already configured.
- Vapi production credentials.
- Any SMS provider credentials.
- Calendar OAuth scopes if/when added.
- Production error/monitoring provider if one is selected.

## Production release

TJ approval required before:
- merging feature/callercore-dashboards into main
- modifying production data intentionally
- enabling new customer billing behavior
- activating live telephony for real clients

## Final prelaunch authorizations discovered in audit

### Hosting / release controls
- Vercel Pro is confirmed and GitHub main-branch protection is complete.
- Native Vercel anomaly monitoring is configured; post-merge validation of the signed webhook email fallback remains.

### Business / tax
- Confirm CallerCore's legal operating entity.
- Confirm Washington business license / UBI and Spokane endorsement where applicable.
- Confirm EIN, business banking, and Stripe account ownership are aligned to the legal entity.
- Review Washington sales-tax/B&O classification with a qualified tax professional.
- Add the Washington tax registration to Stripe Tax once registration is complete.
- Approve enabling Stripe automatic tax after tax classification is confirmed.

### Billing launch
- Live Stripe webhook event coverage and Customer Portal configuration are complete.
- Decide Starter/Growth overage policy.
- Decide Pro high-volume/fair-use policy.
- Final approval to set `CALLERCORE_CHECKOUT_ENABLED=true` only after E2E launch validation.

### Email / identity
- Mailgun sending-domain authentication is verified; DMARC is currently monitoring and can be tightened later.
- Gmail stays admin-only for launch. Broad external Gmail connections require a Google OAuth verification/security-assessment plan.

### Compliance scope
- Standard launch excludes Medical & Dental / HIPAA workflows unless separately reviewed and built.
- Retention periods are approved; scheduled destructive cleanup remains intentionally disabled until provider deletion/recovery testing is complete.
- Consider technology E&O / cyber liability insurance before material customer volume.
