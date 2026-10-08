# Preview recovery acceptance and disposable restore preparation

Updated October 8, 2026. Canonical status remains `CALLERCORE_PROJECT_STATE.md`.

## Approved scheduler contract

- Existing free US QStash resource: `ef5c0de4-c504-4d67-826b-6bac35bc333b`.
- POST only to `https://my-ai-website-git-feature-caller-d75cb2-mohamtaj004bas-projects.vercel.app/api/voice-maintenance`.
- Every five minutes, empty body, 60-second delivery timeout, zero retries.
- Forward `Authorization: Bearer <maintenance credential>` using only `CALLERCORE_VOICE_MAINTENANCE_SECRET`. Never copy the callback credential or add project-wide QStash variables.
- Schedule scd_6X9ZUHpNFLW8NHZ7K1CrYsWcMhdU is installed and hosted-verified on READY dpl_2RT2YKgzzSMDEx5DbuDHmXSBa58o (documentation head 3332bb44e50081c2cf32a2e72b02435616da6dd9, same accepted bdc31fa code). It is paused pending final maintenance credential replacement after browser tool-output exposure. Callback credential unchanged. No project-wide QStash injection.

## Hosted delivery acceptance

- October 8 01:45:00/01:50:00 Pacific scheduled messages both delivered HTTP 200 at 01:45:01/01:50:02. Message IDs and exact deployment evidence are in the canonical project state. Zero retries and 60-second timeout preserved; empty body. Success counters were not present in inspected console history and are not claimed.
- Authenticated JSON false, zero and arbitrary workspace selector rejected 400; maintenance credential on provider webhook/tool ingress rejected 401. GET/missing/invalid credentials were 405/401/401. No callback credential was retrieved.
- Private after-delivery internal/demo exports validated and all 13 full-data comparison surfaces unchanged: canonical/display calls, journals, usage, contacts, leads, conversations, appointments, automations, pending/followup state and derived notification identity/content, plus workspace identity. Internal remained 14 calls/1,484 seconds; demo 1 call/177 seconds; zero pending in both. This demonstrates no duplicates across recurring scans of populated records.
- Concurrent owned/replaced leases, pending-result processing and canonical replay remain separately simulated behavioral evidence (84 focused tests). This run did not manufacture new PSTN calls or pending events.
- Owner must replace only the maintenance credential in branch Preview and this paused schedule, then agent redeploys Preview and verifies positive authentication before resuming. Future inspection must allowlist IDs/status/error fields only, never raw header/request snapshots. This credential remediation does not require another scheduler approval.
## Backup observation

Source database `callercore-preview-redis`, provider ID `b7edf57b-6c72-4c5e-8582-308303f93ced`, Vercel store `store_BaC9e3h6wkqaXdWI`, is connected to Preview only. Daily Backup was rechecked enabled with one-day retention. Inventory currently shows only completed manual baseline `callercore-preview-baseline-20261008`, 7.49 MB; first automatic daily execution is not yet observed. The approved $1/month backup spending limit is not a provider-enforced cap. Overall database cost is not backup-specific cost.

## Disposable managed restore procedure — prepared, not authorized or executed

Upstash supports restoring a backup from another database in the same account/team, and deletes all existing target data first: [provider backup documentation](https://upstash.com/docs/redis/features/backup).

1. TJ must select/approve a separate disposable target and explicitly authorize erasing that exact target. Proposed name: `callercore-restore-rehearsal-20261008`; no resource is created by this document.
2. Record target provider/store IDs and endpoint. Reject the source ID above, any active Preview/Production store or endpoint, and any database holding data intended for preservation. Verify target is empty and has no connected application projects, environment injection, scheduler, webhook or provider credentials.
3. Use the target database's **Restore...** control, selecting the source above and completed baseline. Review exact source, backup and target IDs before TJ authorizes **Start Restore**. Never use the baseline row's Restore button on active Preview.
4. Record completion timestamp and provider outcome. With read-only target access, validate recovered workspace ownership, configuration, canonical call/journal IDs, pending queues, CRM/follow-up relationships and usage associations. Compare against the backup-time manifest rather than newer active data. Previously reported internal/demo counts describe earlier exports, not a certified manifest of this managed backup.
5. Run provider-independent validation and simulated replay/concurrency checks against an isolated harness with provider/network mutations disabled. Do not start the application against the restored database: restored sessions, email queues and provider bindings must never become active automatically.
6. Verify active Preview/Production bindings and deployment remain unchanged. Keep raw restored data private; publish only counts and validation outcomes. Any future reconnection, target deletion or customer activation requires its own authorized scope.

No managed restore, automatic provider reconnection, customer activation or Production release is claimed.
