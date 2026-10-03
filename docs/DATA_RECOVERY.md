# CallerCore Data Recovery & Backup Notes

Updated: 2026-09-21

CallerCore currently uses Vercel KV / Upstash as the primary application persistence layer.

## Current recovery tools

- Clients can download an authenticated JSON export of their current workspace from Settings.
- Admin has client configuration snapshots/audit history for important mutations.
- Admin can restore supported configuration snapshots from audit history.
- Signed service agreements preserve the exact accepted version/clauses/plan snapshot.
- Stripe remains the billing source of truth for linked subscriptions.
- Gmail remains the source of truth for connected mailbox messages.

## Important limitation

KV is being used for an increasingly relational data model. Workspace export and audit history improve recoverability, but they are not a substitute for a tested platform-level backup/restore process.

Before broad production launch, confirm:
- Upstash/Vercel backup/restore capabilities for the selected plan
- retention window
- point-in-time recovery behavior if available
- who can initiate a restore
- how a restore affects data written after the restore point

## Recovery priority

Restore in this order where dependencies apply:
1. workspace / user mappings
2. settings / plan / billing linkage
3. phone/agent configuration
4. leads / calls / conversations / appointments
5. support / audit / analytics
6. non-critical derived caches

External provider state should be reconciled after application data recovery.

## Future database migration

As CallerCore grows, move relationship-heavy operational data to a relational datastore such as Postgres when KV starts creating unacceptable complexity for:
- joins / reporting
- indexing
- migrations
- transactional updates
- backup / point-in-time restore
- data integrity constraints

KV can remain useful for sessions, caches, rate limits, locks, and ephemeral state.
