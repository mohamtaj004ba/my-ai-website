# CallerCore Data Retention & Deletion Policy

Status: Approved launch retention model — destructive automation pending validation  
Updated: 2026-09-21

## Principles

CallerCore should retain customer and caller data only as long as it is useful for delivering the service, resolving support/billing issues, maintaining security and auditability, or meeting applicable legal obligations.

Destructive scheduled automation must not be enabled until recovery, retention archives, provider deletion, and hold behavior are tested.

## Proposed retention matrix

| Data category | Proposed active retention | After account cancellation/deletion | Notes |
| --- | --- | --- | --- |
| Call recordings | 90 days | Delete within 30 days unless legal/support hold | Shortest-lived high-sensitivity operational data. Recording can be disabled per customer/workflow. |
| Call transcripts & AI summaries | 180 days | Delete within 30 days unless hold | Retained longer than audio for searchable call history and dispute/support context. |
| Call metadata (time, duration, outcome, routing, provider IDs, cost) | 24 months | Retain up to 24 months | Lower-sensitivity operational/billing evidence; do not retain recording content solely because metadata is retained. |
| Leads / caller contact records | Active account + 24 months | Delete/anonymize within 30 days after deletion request; otherwise up to 24 months after cancellation | Customer may export before deletion. |
| Conversation / SMS content | 12 months | Delete within 30 days unless hold | Consent/opt-out state is retained separately from message content. |
| SMS consent / opt-out suppression records | Indefinite while number may be contacted | Preserve minimum suppression data after account deletion | Keep only what is needed to prevent re-contacting opted-out recipients. |
| Appointments | 24 months | Delete/anonymize within 30 days after deletion request unless needed for a dispute | Calendar provider may have separate retention. |
| Customer workspace/profile/configuration | Active account | 30-day soft-delete/recovery window, then permanent deletion | Billing identifiers may remain separately where required. |
| Signed service agreements & acceptance evidence | 7 years after termination | Retain for contract evidence | Store only signed agreement and necessary acceptance metadata. |
| Billing/invoice/payment records | 7 years | Retain independently of workspace deletion | Stripe remains source of truth for payment-card data; CallerCore does not store full card data. |
| Support tickets / account correspondence | 24 months after closure | Then delete or de-identify | Extend only when tied to an unresolved dispute/security matter. |
| Security/audit logs | 24 months | Retain independently where needed for security/investigation | Avoid message bodies/secrets in audit logs. |
| Authentication sessions | 7 days | Expire automatically | Current session TTL. |
| Magic-link login tokens | 15 minutes / one-time | Expire automatically | Current implementation. |
| Onboarding secure tokens | 30–90 days depending on stage | Expire automatically | Current implementation already uses bounded TTLs. |
| Website analytics sessions | 180 days | Expire automatically | Retain enough raw session history for recent-funnel analysis while limiting long-lived visitor-level data. |
| Raw first-party website events | 180 days | Delete as rolling window advances | Convert current size-bounded storage to explicit time-bounded retention. |
| Aggregated/anonymized analytics | Indefinite | Retain indefinitely | No direct personal identifiers. Use for year-over-year, cohort, conversion, usage and business-performance analysis. |
| Monthly KPI snapshots | Indefinite | Retain indefinitely | Preserve historical metrics even after underlying raw events expire. |
| Unconverted website prospects / contact-form leads | 12 months from last meaningful interaction | Delete/de-identify after 12 months unless consent/customer relationship continues | Converted prospects follow customer/lead retention instead. |
| Gmail message cache | 24 hours target | Expire automatically; Gmail remains source of truth | OAuth tokens are deleted when integration is disconnected; Gmail messages are not deleted from Google by CallerCore. |
| Gmail OAuth credentials | While connected | Delete immediately on disconnect | Encrypted at rest. |
| Provider webhook dedupe/idempotency keys | 90 days | Expire automatically | Current Stripe behavior; use similar bounded TTL for other providers. |
| Backups/exports | 30 days maximum unless explicitly retained by owner/customer | Securely delete after window | Avoid indefinite copies outside primary storage. |

## Holds and exceptions

Automatic deletion should pause only for a documented reason:
- active legal request, dispute, chargeback, fraud or security investigation;
- explicit customer request for temporary preservation;
- a legal/accounting retention obligation applying to a specific record class.

A hold should be scoped to the minimum data and duration necessary. Holds should not become indefinite by default.

## Customer deletion workflow

1. Verify the requester controls the customer account or has authorized authority.
2. Offer/export the customer's workspace data before destructive deletion when appropriate.
3. Mark the workspace pending deletion and revoke active sessions/integrations.
4. Apply a 30-day recoverable soft-delete window unless immediate deletion is legally required.
5. Permanently delete customer-content stores after the recovery window.
6. Preserve only separately justified records such as billing/contract evidence, opt-out suppression, or security records.
7. Log the deletion action without logging deleted content.
8. Notify the requester when deletion is complete.

## Provider deletion responsibility

CallerCore must separately delete or configure retention at providers that store copies of customer content, including voice/telephony, messaging, AI, email, calendar, storage and observability providers. Removing a KV/database record alone is not sufficient where the provider retains the underlying recording, transcript, message or file.

## Implementation plan

### Before launch
- Establish permanent monthly analytics rollups before relying on raw-event expiration.
- Add these periods to the public Privacy Policy in plain language.
- Ensure Vapi/voice provider recording retention matches the approved 90-day recording period or is shorter.
- Ensure SMS/message provider retention does not silently exceed CallerCore policy where configuration is available.
- Admin deletion workflow implemented with export capability, 30-day soft-delete, access revocation, restore, and explicit permanent-delete confirmation.
- Maintain an explicit opt-out suppression store separate from disposable message content.

### Shortly after launch
- Add scheduled retention cleanup for calls, transcripts, messages, appointments, stale prospects and audit/support data.
- Convert raw site-event storage from size-bounded-only to an explicit 180-day time-bounded window.
- Create durable monthly KPI rollups (for example `analytics:monthly:YYYY-MM`) for visitors, leads, conversion rate, acquisition sources, plan mix, churn, MRR/ARR, calls, minutes, appointments, call outcomes, transfers, payment failures and other business metrics.
- Keep only aggregated/anonymized values in permanent analytics history; do not carry visitor IDs, caller phone numbers, transcripts, message bodies or other direct identifiers into indefinite rollups.
- Add provider deletion reconciliation and a retention-cleanup audit event.
- Add data-hold metadata and expiry to prevent accidental deletion during legitimate holds.
- Add a periodic retention report in the admin dashboard.

## Public-policy language

Do not promise that every record is deleted immediately when a customer cancels. Cancellation and deletion are different actions. The public policy should describe category-specific retention, the 30-day workspace recovery window, exceptions for billing/contracts/security/opt-out suppression, and the ability to request deletion at support@callercore.com.

## Approved analytics retention model

CallerCore may retain aggregated or anonymized business-performance information indefinitely where it no longer identifies an individual caller, website visitor, lead, or customer contact.

This includes historical totals, ratios, cohorts and trend data used for:
- month-over-month and year-over-year comparisons;
- revenue, MRR/ARR and churn trends;
- plan mix and customer-cohort performance;
- website traffic and conversion rates;
- lead generation and acquisition-source performance;
- aggregate call volume, duration and outcomes;
- aggregate appointment and transfer rates;
- aggregate AI containment, escalation and operational performance;
- aggregate support and billing-failure trends.

Permanent analytics rollups must exclude direct identifiers and raw content.
