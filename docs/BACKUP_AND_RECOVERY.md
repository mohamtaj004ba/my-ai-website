# CallerCore Backup and Recovery

Updated: 2026-09-21

## Goals

CallerCore must be able to:
- export a complete client workspace without exposing secrets;
- recover recent configuration changes from audit snapshots where supported;
- preserve enough data to reconstruct a client account if the primary KV store is unavailable;
- avoid treating Stripe, Gmail, Vapi, or other third-party systems as if their external data is automatically backed up by CallerCore.

## Current built-in recovery capabilities

CallerCore already provides:
- client workspace JSON export;
- admin workspace JSON export;
- audit history for configuration changes;
- point-in-time restore for supported audited configuration sections;
- Stripe customer/subscription identifiers in the workspace record;
- onboarding, support, call, lead, appointment, location, automation, settings, agent, integration, and audit data in workspace export;
- secret-shaped field redaction before workspace export.

Exports intentionally do not act as a credentials backup.

## Export contents

Workspace export version 1.0 includes, when present:
- workspace metadata and plan;
- client settings;
- AI agent configuration;
- phone assignment metadata;
- locations;
- integration configuration;
- calls;
- leads;
- conversations;
- appointments;
- automations;
- support tickets;
- onboarding state;
- audit history.

Fields whose names indicate passwords, secrets, API keys, access tokens, refresh tokens, private keys, or webhook secrets are replaced with `[redacted]`.

## Operating backup policy

Until CallerCore moves to a persistence layer with managed point-in-time recovery:

1. Before any destructive admin action, download the affected workspace export.
2. Before material production configuration migrations, export every affected workspace.
3. Before changing billing-plan mapping or phone ownership, record the related Stripe/customer/subscription and telephony identifiers.
4. Retain operational exports in a secure owner-controlled location with access restricted to authorized CallerCore operators.
5. Never place raw exports containing customer data in GitHub, public cloud folders, tickets, chat messages, or source control.
6. Do not use workspace exports as a substitute for provider-native backups or records.

## Restore hierarchy

Use the least invasive recovery method first:

1. **Audit restore** — for a supported recent configuration change.
2. **Manual field reconstruction** — from a known-good workspace export.
3. **Provider reconciliation** — verify Stripe/Gmail/telephony identifiers against the provider before writing them back.
4. **Full workspace reconstruction** — only when the workspace record itself is lost or unrecoverable.

Never overwrite a newer healthy workspace with an older export without first comparing timestamps and externally managed identifiers.

## Provider-specific recovery notes

### Stripe
CallerCore exports identifiers, not card data or Stripe credentials. Stripe remains the system of record for payments, invoices, subscriptions, payment methods, and disputes. Reconcile Stripe state before restoring billing fields.

### Gmail
OAuth tokens are not part of workspace exports. Reconnect Gmail through the OAuth flow when credentials are unavailable or invalid.

### Voice / telephony
When Vapi/telephony is implemented, the provider must remain the source of truth for number ownership, call media, and provider-native call IDs. Do not recreate number assignments from an export without provider verification.

### Email
Sent-message history may exist in Gmail/Mailgun rather than CallerCore KV. Workspace export should not be assumed to contain a complete legal archive of outbound email.

## Recovery validation

After any restore:
- sign in as the client;
- confirm workspace ownership and plan;
- verify tenant isolation;
- verify locations and phone assignment;
- verify agent configuration;
- verify Stripe linkage without creating charges;
- verify onboarding/support state;
- perform a read-only dashboard smoke test;
- document who performed the recovery and why.

## Future improvement

Before CallerCore reaches material production scale, move critical persistence to a database/storage architecture that supports managed backups, point-in-time recovery, and documented retention guarantees. Workspace JSON export remains useful as a portability and incident-response layer, but it should not remain the only backup mechanism.
