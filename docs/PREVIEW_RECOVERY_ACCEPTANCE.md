# Preview recovery acceptance and disposable restore preparation

Updated October 8, 2026. Canonical status remains `CALLERCORE_PROJECT_STATE.md`.

## Approved scheduler contract

- Existing free US QStash resource: `ef5c0de4-c504-4d67-826b-6bac35bc333b`.
- POST only to `https://my-ai-website-git-feature-caller-d75cb2-mohamtaj004bas-projects.vercel.app/api/voice-maintenance`.
- Every five minutes, empty body, 60-second delivery timeout, zero retries.
- Forward `Authorization: Bearer <maintenance credential>` using only `CALLERCORE_VOICE_MAINTENANCE_SECRET`. Never copy the callback credential or add project-wide QStash variables.
- Schedule scd_6X9ZUHpNFLW8NHZ7K1CrYsWcMhdU is installed and hosted-verified on READY dpl_2RT2YKgzzSMDEx5DbuDHmXSBa58o (documentation head 3332bb44e50081c2cf32a2e72b02435616da6dd9, same accepted bdc31fa code). Final maintenance replacement is complete, and the schedule is active with HTTP 200 delivery at October 8 02:15 Pacific on dpl_BwEsfnJ74Vwyxpbe3Qu5ZjsghTfG (1bb92e8432eab25dec58169ba5bac00d86293a02, same accepted code). Callback credential unchanged. No project-wide QStash injection.

## Hosted delivery acceptance

- October 8 01:45:00/01:50:00 Pacific scheduled messages both delivered HTTP 200 at 01:45:01/01:50:02. Message IDs and exact deployment evidence are in the canonical project state. Zero retries and 60-second timeout preserved; empty body. Success counters were not present in inspected console history and are not claimed.
- Authenticated JSON false, zero and arbitrary workspace selector rejected 400; maintenance credential on provider webhook/tool ingress rejected 401. GET/missing/invalid credentials were 405/401/401. No callback credential was retrieved.
- Private after-delivery internal/demo exports validated and all 13 full-data comparison surfaces unchanged: canonical/display calls, journals, usage, contacts, leads, conversations, appointments, automations, pending/followup state and derived notification identity/content, plus workspace identity. Internal remained 14 calls/1,484 seconds; demo 1 call/177 seconds; zero pending in both. This demonstrates no duplicates across recurring scans of populated records.
- Concurrent owned/replaced leases, pending-result processing and canonical replay remain separately simulated behavioral evidence (84 focused tests). This run did not manufacture new PSTN calls or pending events.
- Owner completed final maintenance-only replacement in branch Preview and existing schedule; Preview redeployed and final positive authentication verified. No further credential action needed. Future inspection must allowlist IDs/status/error fields only, never raw header/request snapshots. This credential remediation does not require another scheduler approval.
## Backup observation

Source database `callercore-preview-redis`, provider ID `b7edf57b-6c72-4c5e-8582-308303f93ced`, Vercel store `store_BaC9e3h6wkqaXdWI`, is connected to Preview only. Daily Backup was rechecked enabled with one-day retention. Inventory currently shows only completed manual baseline `callercore-preview-baseline-20261008`, 7.49 MB; first automatic daily execution is not yet observed. The approved $1/month backup spending limit is not a provider-enforced cap. Overall database cost is not backup-specific cost.

## Disposable managed restore — authorized and completed

Upstash supports restoring a backup from another database in the same account/team, and deletes all existing target data first: [provider backup documentation](https://upstash.com/docs/redis/features/backup).

1. TJ authorized creating `callercore-restore-rehearsal-20261008`, erasing that target for restore, and up to $1 total additional Pay As You Go spending. This is not a provider-enforced hard cap. Target created with Auto Upgrade, Prod Pack and Eviction off, no read regions, primary sfo1/us-west-1; existing integration reused, project connection skipped.
2. Record target provider/store IDs and endpoint. Reject the source ID above, any active Preview/Production store or endpoint, and any database holding data intended for preservation. Verify target is empty and has no connected application projects, environment injection, scheduler, webhook or provider credentials.
3. Use the target database's **Restore...** control, selecting the source above and completed baseline. Exact approved source/backup/target identity was checked before **Start Restore**. Never use the baseline row's Restore button on active Preview.
4. Record completion timestamp and provider outcome. With read-only target access, validate recovered workspace ownership, configuration, canonical call/journal IDs, pending queues, CRM/follow-up relationships and usage associations. Compare against the backup-time manifest rather than newer active data. Previously reported internal/demo counts describe earlier exports, not a certified manifest of this managed backup.
5. Run provider-independent validation and simulated replay/concurrency checks against an isolated harness with provider/network mutations disabled. Do not start the application against the restored database: restored sessions, email queues and provider bindings must never become active automatically.
6. Verify active Preview/Production bindings and deployment remain unchanged. Keep raw restored data private; publish only counts and validation outcomes. Any future reconnection, target deletion or customer activation requires its own authorized scope.

### Recorded acceptance

- Target provider ID `d724ba44-3e29-4509-971a-b03a846d6d3b`, Vercel store `store_gKsm59LbCKKcc8rS`, initially 0 B and zero connected projects. Target daily backups remain off. No application environment injection or credentials revealed.
- Source manual baseline `callercore-preview-baseline-20261008`, backup ID `131b9743-c324-4e77-bd2e-efc2c27e9d7d`, 7.49 MB. Target Restore History reports COMPLETED; observed before `2026-10-08T09:41:36Z`. Exact provider completion timestamp unavailable in inspected view. Restored target DBSIZE: 3,101 keys.
- Read-only selected record validation: workspace identities and internal/demo purposes; unique canonical/display call IDs; journals; contacts and lead links; usage seconds/month/purpose; pending queue associations; follow-up overrides and derived notification identities.
- Internal recovered: 14 calls/journals/usage entries, 1,484 seconds, 3 contacts, 5 leads, 12 open follow-ups, 9 derived notifications, zero pending. Demo: 1 call/journal/usage/contact/lead, 177 seconds, 1 follow-up/notification, zero pending. Follow-up override keys absent in both; existing call classifier supplies derived state.
- Original Redis JSON was preserved for validation. Lua cjson round-tripping maps empty objects to arrays and omitted absent values; the initial read representation was rejected by the validator and replaced with raw selected GET strings. This was an inspection representation issue, not a restored-data repair; no database writes performed.
- Eight complete selected surfaces match previous private after-delivery exports: display/canonical calls, leads, contacts, journals, usage, pending and follow-up overrides. These exports are newer than the managed backup. No backup-time full manifest, TTL equality, whole-database identity, PITR, restored session behavior or provider reconnection is claimed.
- Actual restored journals replayed through `lib/voice-store.js` mutateCall in an isolated in-memory harness: 48 internal + 3 demo operations, all return prior results before transforms/transactions, zero writes and unchanged full recovered business state. Provider/network clients absent. Raw restored data and harness outputs remain private outside the repository.
- Focused export/recovery/auth/runner/lease suite: 37 tests passed, zero failures/skips. No application code changed; full 1,855-test/CI/CodeQL/authenticated Browser QA evidence remains pinned to bdc31fa in canonical state.
- Source binding remains my-ai-website Preview only; target remains unconnected. Production deployment/main/PR draft boundaries unchanged. No application, restored integration, notification, billing or provider activation. Source daily backup on; only manual baseline listed, first automatic execution unobserved.

This proves the scoped managed restore and recovered-record replay above. Any future reconnection or target deletion requires separate authorization. All customer/Production launch gates remain closed.
