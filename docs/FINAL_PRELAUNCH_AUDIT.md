# CallerCore Final Prelaunch Audit

Updated: 2026-09-21

This is the final prelaunch matrix for CallerCore. It is organized from the customer, operator/admin, technical, compliance, and business perspectives.

## Launch status

### Green — implemented / substantially ready
- Public marketing site, pricing, contact and legal pages.
- Embedded Stripe Checkout with explicit checkout launch gate.
- Customer workspace creation and managed onboarding lifecycle.
- Passwordless authentication, session revocation, tenant scoping and read-only admin client view.
- Client dashboard and admin operations dashboard.
- Agreement v2 snapshots and signed PDF generation.
- Support workflow and branded lifecycle emails.
- Gmail admin inbox integration with encrypted OAuth tokens and quota-aware loading.
- Website crawl SSRF defenses.
- Same-origin mutation protection and same-host Vercel preview origin checks.
- Stripe signature verification and global webhook idempotency.
- Public endpoint rate limiting; cost-bearing/sensitive public endpoints fail closed if rate-limit storage is unavailable.
- Secret-pattern CI checks and secret redaction in workspace exports.
- Workspace export, audited admin export, audit restore support, backup/recovery runbook and incident-response runbook.
- Customer/admin degraded-data banners so API failures are not displayed as trustworthy zero-value business data.
- Standard onboarding blocks Medical & Dental and rejects regulated medical onboarding server-side.
- GitHub CI regression suite.
- CodeQL workflow and Dependabot configuration.
- Production health checks for KV and live Stripe webhook/Customer Portal readiness.
- Vercel Pro commercial hosting confirmed.
- GitHub `main` ruleset active with PR requirement, strict `test` and `Analyze JavaScript` checks, force-push/deletion protection, and no bypass.
- Live Stripe webhook now subscribes to all seven handled events; Stripe Customer Portal is active.
- Mailgun sending domain `notify.callercore.com` verified; SPF/DKIM present; DMARC present in monitoring mode; production Mailgun domain configuration corrected.
- Gmail integration intentionally remains admin-only at launch and requests only `gmail.modify`.
- Category-specific retention policy approved, with indefinite aggregated/anonymized analytics and bounded raw data.
- Recoverable customer deletion flow implemented with 30-day recovery, access revocation, restore, explicit purge confirmation, and separate retention archives.
- Public launch copy no longer sells SMS or calendar booking as currently active.
- Verified pre-release rollback baseline recorded: Vercel deployment `dpl_DkoEXfYyfenw7Hee18cmwygc92fV` on main commit `7cc9562e71bcc63ccc3bcec390a1a601fba2b874`.
- Server logging hardened to sanitize bounded error messages and avoid raw AI/provider payloads, request content, customer URLs, and raw Error objects; CI now enforces log-privacy safeguards.

## Customer journey — required before sales open

### Checkout / billing
- Keep `CALLERCORE_CHECKOUT_ENABLED` closed until the final launch authorization.
- Complete Washington tax registration/classification and configure Stripe Tax registrations/product tax treatment.
- Enable Stripe automatic tax only after the tax setup is legally correct.
- Test success, asynchronous payment, failed payment, cancellation, portal access and recovery in Stripe test mode.
- Decide and disclose the minute-overage policy before selling Starter/Growth usage above allowance.
- Define Pro unlimited/fair-use policy before selling Pro at material call volume.

### Onboarding
- Run one disposable customer from prospect -> checkout -> payment -> review -> agreement -> intake -> build -> QA -> test call -> approval -> live.
- Verify every email is received, links work, holds/approval gates behave correctly and support replies work.
- Confirm clients cannot accidentally bypass managed review or onboarding state gates.
- Verify customer-visible empty/degraded/error states in a real browser.

### Voice
- Complete Vapi production integration.
- Provision and assign a real phone number.
- Connect number to the correct assistant/workspace.
- Authenticate Vapi/provider webhooks.
- Ingest call status, duration, provider IDs and cost.
- Store/transmit recording and transcript references safely.
- Capture transfers and transfer outcomes.
- Aggregate minutes into usage/billing analytics.
- Test normal, urgent, emergency, transfer, hangup, voicemail/no-answer and provider-error calls.
- Always use a legally reviewed recording disclosure when recording is enabled.

### Calendar / appointment booking
- Choose launch calendar provider strategy.
- Implement real availability, booking, cancel/reschedule and timezone behavior.
- If not ready at launch, do not market/sell appointment booking as active.

### SMS / messaging
- Choose provider/number strategy.
- Implement consent provenance and transactional-vs-marketing separation.
- Implement STOP/HELP suppression and make opt-out impossible to bypass accidentally.
- Implement delivery/failure status.
- Complete required carrier/A2P registration.
- If not ready at launch, do not market/sell SMS campaigns or automated follow-up as active.

## Admin / operations — required before launch
- Protected Preview access was verified with Vercel Automation Protection Bypass.
- Preview KV connectivity is verified operational through the health endpoint.
- Protected preview static/legal/dashboard assets and unauthenticated API access-control smoke tests passed on the cleaned release head.
- Temporary preview diagnostics were removed and verified 404 before release.
- Regenerate the automation-bypass secret after this QA cycle because the test value was handled interactively.
- Full authenticated POST/browser E2E with a disposable client is still required before release.
- Confirm Preview KV is isolated from Production KV before destructive disposable-client testing.
- Verify System Health correctly shows all production blockers.
- Confirm support@callercore.com inbound and outbound behavior.
- Tighten DMARC from monitoring toward enforcement after continued Google Workspace/Mailgun alignment is verified.
- Native Vercel production anomaly rule is configured; signed webhook email fallback is coded/configured. Production fallback delivery test remains after PR #5 is merged.
- Export a disposable workspace and perform a recovery drill.

## Hosting / infrastructure — required before commercial launch
- Verify production vs preview environment-variable scoping.
- Keep preview bootstrap credentials preview-only.
- Confirm production KV/storage credentials and provider ownership.
- Before material scale, move critical persistence to storage with provider-managed backup/PITR; current workspace exports are an interim recovery layer.

## Business / legal / tax — owner authorization required
- Confirm the legal operating entity for CallerCore.
- If operating as a Washington entity, complete Secretary of State formation as applicable.
- Obtain/confirm Washington business license/UBI.
- If operating in Spokane city limits or doing business in Spokane, obtain/confirm the required Spokane business registration/endorsement.
- Confirm EIN/business banking/payment-account ownership.
- Review Washington sales-tax and B&O treatment with a qualified tax professional; CallerCore has SaaS/DAS/technology-service characteristics that can be taxable.
- Add the correct legal entity name to Terms, Service Agreement, Stripe statements/receipts and business communications.
- Attorney review: Service Agreement, Terms, Privacy Policy, recording consent, SMS/TCPA policy and retention/deletion policy.
- Consider technology E&O/cyber liability insurance before serving material customer volume.

## Google / email
- Gmail is intentionally admin-only at launch and requests only `gmail.modify`.
- `gmail.modify` is a Google restricted scope; do not expose customer Gmail connections without the required Google verification/security-assessment path or a narrower redesign.
- Active Mailgun sending domain is `notify.callercore.com`; SPF/DKIM are verified and DMARC is present in monitoring mode.
- Legacy `mail.callercore.com` records are GHL-era infrastructure and should be cleaned up only after final production mail validation.

## Security items to revisit after core launch
- Replace CSP `unsafe-inline` with nonces/hashes as the frontend is modularized.
- Split `api/account.js` into feature-specific modules to reduce authorization-review surface.
- Split `dashboard.js` into client/admin feature modules.
- Re-run tenant/auth review after every new authenticated integration.
- Add provider-specific webhook verification tests for Vapi/SMS/calendar.
- Perform an independent penetration test before enterprise/regulated customers.
- Add formal security/privacy vendor inventory and subprocessor list.
- Consider a customer-facing security page/DPA before larger B2B sales.

## Explicit launch authorization sequence
1. Business/legal/tax registrations confirmed.
2. Vercel Pro commercial plan confirmed. ✅
3. Stripe webhook + Portal completed; Washington tax registration/Stripe Tax configuration still pending.
4. Vapi/voice implemented and tested.
5. Calendar/SMS removed from active launch promises; integrations may be added later.
6. Email authentication verified; monitoring fallback requires post-merge production test.
7. Protected preview browser QA passes.
8. Disposable-client E2E passes.
9. GitHub main protection enabled. ✅
10. TJ authorizes production merge.
11. Merge PR #5.
12. Validate production health and logs.
13. TJ authorizes `CALLERCORE_CHECKOUT_ENABLED=true`.
14. Open sales.
