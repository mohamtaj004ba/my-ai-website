# Preview voice maintenance runner

The reusable runner is implemented and tested. The approved five-minute QStash schedule is installed and delivery-verified. Current canonical evidence is in [CALLERCORE_PROJECT_STATE.md](../CALLERCORE_PROJECT_STATE.md) and [Preview recovery acceptance](PREVIEW_RECOVERY_ACCEPTANCE.md). Provider access remains confined to isolated internal/demo assistants; Production/customer phone activation is closed.

## Exact contract

- Execute `node scripts/voice-maintenance-runner.mjs` from the verified feature-branch revision.
- `CALLERCORE_VOICE_MAINTENANCE_URL` must be exactly `https://my-ai-website-git-feature-caller-d75cb2-mohamtaj004bas-projects.vercel.app/api/voice-maintenance`.
- Use only `CALLERCORE_VOICE_MAINTENANCE_SECRET` through the approved scheduler secret store, never a command argument, repository file, URL, chat or log. Existing callback credential remains unchanged and must not be copied into the scheduler. The legacy runner fallback is not the current approved installation contract.
- QStash sends an empty POST body; the standalone runner sends `{}`. Both carry no workspace selectors. The server chooses only its designated isolated bindings and validates workspace eligibility before recovery.
- Use a five-minute cadence with one job at a time. The process deadline is sixty seconds; workspace recovery has its own lock and fair cursor. No redirect or automatic request retry is permitted. A timeout is uncertain and does not authorize a blind replay.
- Successful output contains only workspace/checked/failed/pending/busy counts. No configured resources, malformed response, provider failure or unknown pending state fails the run. Pending details alone can remain while artifacts are delayed; they are not replaced with invented transcripts.

## Installed scope and change boundary

Existing free US QStash resource `ef5c0de4-c504-4d67-826b-6bac35bc333b`, schedule `scd_6X9ZUHpNFLW8NHZ7K1CrYsWcMhdU`: exact stable Preview endpoint above, every five minutes UTC, 60-second timeout and zero retries. Separate sensitive maintenance credential is scoped only to feature/callercore-dashboards Preview and the existing approved schedule. Resource remains unconnected to application projects; no broad QStash environment injection. Final maintenance-only credential replacement and HTTP 200 acceptance completed; do not request another rotation without new evidence.

Two recurring hosted HTTP 200 deliveries five minutes apart and complete internal/demo business comparisons passed. Final replacement value also delivered HTTP 200. Exact message/deployment IDs and simulated lease/ownership scope are in canonical state. Do not create a duplicate schedule, widen credential destinations, change retry behavior or install a Production cron. GitHub scheduled workflows run from the default branch and must not be activated through a prohibited main merge. Successful delivery is not customer activation or full pending/concurrency stress evidence.
