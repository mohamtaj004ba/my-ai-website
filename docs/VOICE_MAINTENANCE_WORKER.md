# Preview voice maintenance runner

The reusable runner is implemented and tested. A recurring scheduler is not installed. Provider access remains confined to the isolated internal/demo assistants, and Production/customer phone activation is closed.

## Exact contract

- Execute `node scripts/voice-maintenance-runner.mjs` from the verified feature-branch revision.
- `CALLERCORE_VOICE_MAINTENANCE_URL` must be exactly `https://my-ai-website-git-feature-caller-d75cb2-mohamtaj004bas-projects.vercel.app/api/voice-maintenance`.
- `CALLERCORE_VOICE_WEBHOOK_SECRET` must be supplied through an approved secret store, never a command argument, repository file, URL, chat or log.
- POST body is empty JSON; no workspace selectors are allowed. The server chooses only its designated isolated bindings and validates workspace eligibility before recovery.
- Use a five-minute cadence with one job at a time. The process deadline is sixty seconds; workspace recovery has its own lock and fair cursor. No redirect or automatic request retry is permitted. A timeout is uncertain and does not authorize a blind replay.
- Successful output contains only workspace/checked/failed/pending/busy counts. No configured resources, malformed response, provider failure or unknown pending state fails the run. Pending details alone can remain while artifacts are delayed; they are not replaced with invented transcripts.

## Installation boundary

The existing callback credential was authorized for storage in branch-scoped Vercel Preview. Copying it into GitHub Actions, another scheduler or an operator machine requires approval of that exact destination. No secret was copied to a new service. A Vercel Production cron is not a Preview workaround; do not add one. GitHub scheduled workflows run from the default branch and must not be activated through a prohibited main merge.

After a scheduler/secret destination is approved, install this runner without changing the endpoint, resource restrictions or credential scope. Verify one run, inspect canonical call/CRM/usage counts for no duplicates, then record recurring delivery and alert behavior. Endpoint/unit/browser tests do not establish an installed recurring worker.
