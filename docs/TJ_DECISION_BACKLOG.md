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
