# CallerCore Production Readiness

Updated: 2026-09-21

This document tracks the release-readiness state of the feature branch. It is intentionally focused on work that materially affects reliability, security, customer trust, and the ability to operate paying accounts.

## Ready / substantially implemented

- Public website, pricing, contact, Get Started, chatbot, legal pages, analytics.
- First-party website funnel analytics and prospect persistence.
- Client authentication with passwordless sign-in and session revocation.
- Admin authentication, role checks, read-only client impersonation, access repair, audit history, and deletion safeguards.
- Client dashboard with plan entitlements, leads, conversations, appointments surfaces, AI agent settings, routing, locations, automations, analytics, billing, settings, support.
- Admin operations dashboard with clients, provisioning, inbox, prospects, support, phone inventory, system health, revenue/usage, and platform settings.
- Smart Onboarding with website scan, structured intake, agreement signing, automatic workspace population, agent draft generation, and launch checklist.
- Managed onboarding stages with deliberate human review gates.
- Agreement v2.0 with frozen signed snapshots and plan snapshots.
- Branded lifecycle/auth email system with support contact paths.
- Gmail OAuth, alias support, unified inbox, cached rendering, thread caching, and background refresh.
- Persistent portal notifications, sidebar alert dots, and client notification-category preferences.
- Stripe Embedded Checkout session creation with tracked lead/acquisition context and on-site payment UI.
- Stripe checkout account creation and core subscription lifecycle handling.
- Stripe webhook support for both embedded Checkout metadata and legacy Payment Links.
- Stripe webhook signature verification and global event idempotency.
- Stripe past-due / canceled / payment-recovered state and customer lifecycle emails.
- Security headers, OAuth token encryption, mutation same-origin protection, preview bootstrap protection, safe website-crawl SSRF defenses, and bounded external KV health reporting.
- Automated critical-path tests for pricing/entitlements, business-hours timing, agreement snapshots, and email support requirements.
- GitHub Actions CI and deployment-time test execution.
- Client support channels and stated business-hour expectations.

## Must complete before broad production launch

### Voice / telephony core
- Real Vapi assistant provisioning.
- Real phone-number purchase/assignment.
- Number -> assistant connection.
- Voice webhook signature/authentication.
- Call status ingestion.
- Recordings/transcripts/summaries.
- Transfer outcome capture.
- Cost and duration tracking.
- Usage aggregation into plan billing/analytics.

### End-to-end launch test
Run one complete disposable client through:
1. prospect
2. checkout
3. payment confirmation
4. managed review hold
5. onboarding invite
6. agreement
7. website scan
8. intake
9. generated workspace/agent
10. QA approval
11. test call
12. client approval
13. live activation
14. inbound call
15. lead creation
16. dashboard display
17. billing state

### Billing
- Confirm production Stripe secret key, publishable key, and webhook signing secret are all present in the production environment.
- Confirm Stripe Customer Portal behavior.
- Define and implement minute overage policy, if any.
- Verify subscription-plan change behavior against real Stripe Price IDs.
- Test failed-payment recovery and cancellation in Stripe test mode.

### Calendar / appointments
- Choose calendar scope/provider strategy.
- Connect Google Calendar or another scheduling provider.
- Real availability lookup and booking.
- Cancellation/reschedule behavior.
- Timezone edge cases.

### Messaging
- Choose SMS/telephony provider path.
- Consent/opt-out handling.
- STOP/HELP behavior.
- Delivery-state ingestion.
- Carrier registration where required.

### Legal / compliance
- Attorney review of Service Agreement v2.0.
- Attorney review of Privacy Policy and Terms.
- Confirm call-recording disclosure approach by client/jurisdiction.
- Confirm SMS/TCPA operational policy.
- Confirm data-retention policy.

### Security / reliability
- Resolve/verify the Preview Upstash / Vercel KV connection; the observed DNS lookup failures came from an older `feature/callercore-dashboards` preview deployment, not a production deployment.
- Complete protected-preview browser QA.
- Focused authorization/tenant-isolation security review.
- Webhook security review for all external providers as they are added.
- Backup/export strategy for production data.
- Incident-response and recovery checklist.

## Next engineering improvements after core launch

- Split api/account.js into feature-specific API/service modules.
- Split dashboard.js into client/admin feature modules.
- Introduce a relational persistence layer when KV relationships/reporting become operationally painful.
- Add true multi-user workspaces and granular roles.
- Add unified Contact records across website, Gmail, calls, leads, and appointments.
- Upgrade Gmail to history/push-based incremental synchronization if inbox volume justifies it.
- Add global Admin search across clients, contacts, tickets, calls, prospects, and external IDs.
- Add notification delivery preferences by channel in addition to portal categories.
- Add marketing/campaign subsystem with suppression, unsubscribe, segmentation, analytics, and sender reputation controls.

## Release rule

Do not merge this feature branch to production merely because a feature renders correctly.

Release sequence:
1. feature freeze
2. automated tests green
3. preview/staging smoke test
4. critical path end-to-end test
5. auth/tenant checks
6. webhook/billing checks
7. production env validation
8. deliberate merge/deploy
9. monitor logs/errors
10. rollback if critical regression is found
