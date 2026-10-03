# CallerCore Incident Response Runbook

Updated: 2026-09-21

This is the first-response checklist for material CallerCore production incidents. It is intentionally practical and should evolve as live providers are added.

## Severity

### SEV-1 — Critical
Examples:
- authentication or tenant-isolation failure
- confirmed cross-client data exposure
- widespread inability to answer production calls
- payment/webhook corruption affecting many customers
- compromised production credential
- destructive data loss

Response:
1. stop the affected write/action path if possible
2. preserve logs and timestamps
3. rotate/revoke compromised credentials immediately
4. notify affected provider if relevant
5. identify affected workspaces/data
6. restore or mitigate service
7. communicate accurately with affected customers
8. document root cause and corrective actions before closing

### SEV-2 — Major
Examples:
- one core provider unavailable
- onboarding cannot complete
- Gmail/inbox unavailable
- failed billing lifecycle processing
- significant dashboard/API errors without data exposure

Response:
1. confirm scope
2. inspect Vercel runtime errors/logs
3. inspect Admin -> System Health
4. isolate provider vs application failure
5. mitigate or disable the affected feature if necessary
6. communicate to affected customers if impact is material
7. verify recovery with a real workflow, not only a health check

### SEV-3 — Minor
Examples:
- UI regression
- isolated email failure
- non-critical analytics issue
- cosmetic dashboard defect

Response:
1. reproduce
2. patch on feature branch
3. run automated tests
4. deploy preview
5. verify before production release

## First checks

1. Vercel latest deployment state
2. Vercel runtime errors
3. Admin -> System Health
4. Upstash/KV availability
5. Stripe webhook/event status if billing-related
6. Mailgun delivery status if email-related
7. Gmail OAuth connection if inbox-related
8. Vapi/provider logs once voice is live
9. recent Git commits / release changes

## Data exposure procedure

If cross-tenant or unauthorized data exposure is suspected:

1. treat as SEV-1
2. disable the affected endpoint/action if possible
3. do not delete logs
4. identify exact workspace IDs, users, records, timestamps, and actions involved
5. revoke active sessions for affected accounts
6. rotate relevant credentials/tokens if compromise is possible
7. preserve a timeline
8. consult legal/privacy counsel before making required breach notifications
9. implement and test the authorization fix before restoring the path

## Credential compromise

If any production secret is exposed:

1. revoke/rotate it at the provider immediately
2. update the Vercel environment variable
3. redeploy the affected environment
4. invalidate dependent sessions/tokens if needed
5. inspect provider access logs
6. search repository/history/chats/files for additional exposure
7. document what was exposed and for how long

## Billing incident

For Stripe issues:

1. verify webhook signature configuration
2. inspect the Stripe event and event ID
3. inspect CallerCore workspace Stripe customer/subscription mapping
4. confirm event idempotency state
5. do not manually change plan/status unless necessary and documented
6. reconcile Stripe as billing source of truth
7. communicate with the client if service/billing status changed incorrectly

## Email incident

For Mailgun/Gmail issues:

1. distinguish outbound lifecycle email vs Admin Gmail inbox
2. verify credentials/connection
3. inspect provider status/logs
4. check Gmail quota/rate errors
5. retry only when safe to avoid duplicate customer messages
6. preserve support access through alternate support channels if needed

## Voice incident

Once Vapi is production-connected:

1. determine whether calls are failing before, during, or after assistant connection
2. check number/provider assignment
3. check assistant configuration/version
4. check webhook delivery
5. check transfer destination behavior
6. preserve call IDs, timestamps, recordings/transcripts where available
7. provide a temporary routing fallback if designed/configured

## Recovery validation

An incident is not considered resolved only because logs stop erroring.

Validate the actual customer path:
- login works
- correct tenant data loads
- affected action completes
- notification/email/webhook is delivered when relevant
- no duplicate side effects are created
- audit trail reflects administrative repair if applicable

## Post-incident review

For SEV-1/SEV-2 record:
- summary
- start/end time
- customer impact
- root cause
- contributing factors
- detection method
- mitigation
- permanent fix
- tests added
- follow-up owner/items


## Pre-PR #5 production rollback target

The verified pre-release production baseline is Vercel deployment `dpl_DkoEXfYyfenw7Hee18cmwygc92fV` on main commit `7cc9562e71bcc63ccc3bcec390a1a601fba2b874`.

After PR #5 is released, use this as the first rollback target for a severe release regression unless a newer known-good production deployment has been explicitly recorded. Rollback is a live traffic change and should only be used to restore service, not as a rehearsal.

After rollback, verify production health, 5xx/error logs, authentication, dashboard access, and checkout remains disabled until the incident is understood.
