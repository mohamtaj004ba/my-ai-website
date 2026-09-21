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
Starter: 300 included minutes.
Growth: 600 included minutes.
Pro: unlimited minutes.

Need to decide:
- whether Starter/Growth have overage billing
- exact overage rate
- soft vs hard limits
- alerts at 80%, 90%, 100%
- whether Pro has fair-use language

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
- Data-retention/deletion policy.

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
- Upgrade Vercel from Hobby to a commercial-use plan before taking paying customers.
- Enable/enforce the existing CallerCore GitHub branch ruleset for `main`.
- Choose/authorize a production uptime and error-monitoring provider or operating approach.

### Business / tax
- Confirm CallerCore's legal operating entity.
- Confirm Washington business license / UBI and Spokane endorsement where applicable.
- Confirm EIN, business banking, and Stripe account ownership are aligned to the legal entity.
- Review Washington sales-tax/B&O classification with a qualified tax professional.
- Add the Washington tax registration to Stripe Tax once registration is complete.
- Approve enabling Stripe automatic tax after tax classification is confirmed.

### Billing launch
- Approve adding the five missing live Stripe lifecycle webhook events.
- Approve/activate the Stripe Customer Portal configuration.
- Decide Starter/Growth overage policy.
- Decide Pro unlimited/fair-use policy.
- Final approval to set `CALLERCORE_CHECKOUT_ENABLED=true` only after E2E launch validation.

### Email / identity
- Verify SPF, DKIM, and DMARC for CallerCore sending domains.
- Decide whether the admin Gmail integration stays owner-only or will later be offered to customers; broad external Gmail connections require a Google OAuth verification/security-assessment plan.

### Compliance scope
- Standard launch excludes Medical & Dental / HIPAA workflows unless separately reviewed and built.
- Decide concrete retention periods for call recordings, transcripts, messages, leads, analytics, onboarding records, and audit history.
- Consider technology E&O / cyber liability insurance before material customer volume.
