# Preview recovery acceptance and disposable restore preparation

Updated October 8, 2026. Canonical status remains `CALLERCORE_PROJECT_STATE.md`.

## Approved scheduler contract

- Existing free US QStash resource: `ef5c0de4-c504-4d67-826b-6bac35bc333b`.
- POST only to `https://my-ai-website-git-feature-caller-d75cb2-mohamtaj004bas-projects.vercel.app/api/voice-maintenance`.
- Every five minutes, empty body, 60-second delivery timeout, zero retries.
- Forward `Authorization: Bearer <maintenance credential>` using only `CALLERCORE_VOICE_MAINTENANCE_SECRET`. Never copy the callback credential or add project-wide QStash variables.
- QStash schedule scd_6X9ZUHpNFLW8NHZ7K1CrYsWcMhdU was created October 8 at 01:30:04 Pacific, then paused before its first scheduled run. Owner rotated the branch Preview maintenance credential, and same-code redeployment dpl_DzkJFSCoWoTaruXGnnhM2JuNzPSe is READY at bdc31fa7919d1399c3211a6574c3fa3b648945a5. Browser inspection exposed the entered credential in a tool result; owner must replace only this credential in Vercel and the paused schedule before resuming. Callback credential is unchanged. No positive or recurring delivery acceptance is claimed.
- Do not count Vercel's protected-deployment response as application authentication evidence. The stable branch URL is reachable and rejects GET (405), missing credentials (401), and invalid credentials (401).

## Delivery acceptance remaining after secure credential entry

1. Pin the stable alias to the current feature SHA and verify positive maintenance authentication, rejection of callback credentials, malformed body/query rejection, and rejection of the maintenance credential by webhook/tool routes.
2. Capture private before/after exports from both designated isolated workspaces. Run `validateVoiceExport` from `lib/voice-export.js`; report aggregate counts only.
3. Observe at least two distinct scheduled deliveries five minutes apart. Record schedule ID, timestamps, delivery IDs, destination, retry count, HTTP result and safe counters.
4. Compare canonical call IDs, journals, usage seconds/entries, contacts, leads, follow-up state and notification identities. No new telephone call or billing action is needed. Recovery diagnostic/audit timestamps can change; business mutation counts must not.
5. Existing behavioral tests cover concurrent ownership leases, replacement-lease preservation, bounded/fair recovery and canonical processor replay. They are simulated evidence, separate from scheduled hosted acceptance.

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
