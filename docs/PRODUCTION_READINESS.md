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
- Client/admin workspace JSON export with recursive secret redaction and audited admin exports.
- Audit-snapshot restore support for recoverable configuration sections.
- Backup/recovery operating strategy documented in `docs/BACKUP_AND_RECOVERY.md`.
- Incident-response runbook documented in `docs/INCIDENT_RESPONSE.md`.
- Current server-side tenant/admin write-isolation review backed by regression tests.
- Explicit `CALLERCORE_CHECKOUT_ENABLED` launch gate prevents accidental real sales before final approval.
- Sensitive/cost-bearing public endpoints fail closed if rate-limit storage is unavailable.
- Standard onboarding excludes Medical & Dental and server-side intake rejects regulated medical onboarding.
- CodeQL workflow and Dependabot configuration added.
- Client/admin portals surface partial API failures instead of silently presenting incomplete data as trustworthy zeros.
- Vercel Pro commercial hosting confirmed.
- GitHub main-branch ruleset enabled and verified with required PR/checks and no bypass.
- Live Stripe webhook event coverage and Customer Portal configuration completed.
- Mailgun `notify.callercore.com` verified; production sending-domain configuration corrected.
- Gmail launch posture narrowed to admin-only with only `gmail.modify`.
- Retention policy approved with indefinite anonymized analytics and bounded raw data.
- 30-day recoverable deletion workflow implemented with access revocation, restore and explicit permanent purge.
- Public launch copy no longer promises SMS or calendar booking as active launch features.
- Pre-release rollback baseline is documented and points to the verified READY production deployment before PR #5.
- Server error logging uses a privacy-safe sanitizer; raw provider response bodies and raw Error objects were removed from sensitive API logs, with CI regression coverage.
- System Health now includes explicit owner-confirmed launch gates in addition to technical service checks, preventing a false ready state when business/legal/E2E/voice prerequisites remain open.
- Runtime environment-scope safety checks detect Preview live-Stripe usage, Preview checkout enablement, and Production exposure of Preview bootstrap credentials.
- Admin client tools include a non-destructive recovery drill that validates the exact workspace-export payload without modifying customer data.
- SMS and calendar/appointment capabilities default off behind `CALLERCORE_SMS_ENABLED` and `CALLERCORE_CALENDAR_ENABLED`; launch UI and server writes respect those flags.

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
- Keep `CALLERCORE_CHECKOUT_ENABLED` disabled until the final sales-open authorization.
- Confirm production Stripe secret key, publishable key, and webhook signing secret are all present in the production environment.
- Complete Washington tax registration/classification; Stripe Tax is active but the connected live account currently has no tax registrations configured.
- Configure the correct Stripe product tax treatment and enable automatic tax only after registration/classification is confirmed.
- Define and implement minute overage policy, if any. Current unit-economics planning is documented in `docs/VOICE_UNIT_ECONOMICS.md`.
- Policy-neutral customer/admin usage warnings are implemented at 70% / 85% / 100% of included Starter/Growth minutes; they do not imply or apply an overage charge.
- Define Pro high-volume/fair-use policy before material high-volume usage.
- Verify subscription-plan change behavior against real Stripe Price IDs.
- Test failed-payment recovery and cancellation in Stripe test mode.

### Calendar / appointments
- Calendar booking is not part of the initial advertised launch scope.
- Choose provider/scope and implement availability, booking, cancel/reschedule and timezone behavior before re-enabling calendar-booking marketing claims.

### Messaging
- SMS is not part of the initial advertised launch scope.
- Before enabling it, choose provider/number strategy, implement consent provenance, STOP/HELP suppression, delivery-state ingestion, transactional-vs-marketing separation, and required carrier/A2P registration.

### Legal / compliance
- Confirm CallerCore legal entity / Washington business license / UBI and any Spokane business registration required for the operating location.
- Attorney review of Service Agreement v2.0.
- Attorney review of Privacy Policy and Terms.
- Confirm call-recording disclosure approach by client/jurisdiction.
- Confirm SMS/TCPA operational policy.

### Security / reliability
- Keep DMARC under review and move from monitoring toward enforcement after continued sender alignment validation.
- Vercel anomaly monitoring is configured. Signed webhook-to-email fallback is coded/configured and requires a post-merge production delivery test.
- Protected Preview automation access was successfully used for QA.
- Preview KV health is operational.
- Static/legal/dashboard assets and unauthenticated API access-control smoke checks pass on the cleaned protected preview head.
- support@callercore.com inbound/outbound mailbox behavior is verified from recent CallerCore Gmail history.
- Temporary diagnostic code was removed and verified absent.
- Rotate the automation bypass secret after the completed QA cycle.
- Complete authenticated disposable-client POST/browser E2E before release, and verify Preview KV isolation before destructive testing.
- Keep Gmail admin-only at launch. Complete Google verification/security assessment before offering Gmail connections broadly to external customers.
- Re-run focused authorization/tenant-isolation review when new authenticated API surfaces are added.
- Webhook security review for all external providers as they are added.
- Add provider-managed point-in-time database recovery before CallerCore reaches material production scale; current workspace exports are an interim recovery layer.

## Non-blocking infrastructure debt

- `@vercel/kv` is deprecated upstream and the underlying Vercel KV product has been replaced by the Upstash Marketplace integration. CallerCore's existing store remains operational, but the application should migrate deliberately to the supported Upstash Redis SDK after launch validation rather than changing the persistence client during the current release freeze.
- The recurring Node `url.parse()` deprecation warning appears in runtime paths that use the current persistence/integration stack; no direct CallerCore source use of `url.parse()` was found. Re-check after the Upstash client migration.

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
