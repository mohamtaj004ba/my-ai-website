# Agent Operations: Phase 1 architecture and feasibility

Date: October 11, 2026. Status: inspected; architecture proposal and offline safety scaffolding. This is not operational multi-agent acceptance.

## Verified baseline

Inspection starts at feature/callercore-dashboards head bd6e7406da0d48fb88dd1360e3983cc26806f164. PR #5 is open, draft, unmerged; its base is main at 37ef5cfcdccae35952822859f64fe83f0b9f09f0. Read CALLERCORE_PROJECT_STATE.md, current history, package.json, api/account.js, lib/auth.js, lib/kv.js, lib/config-transaction.js, lib/voice-recovery.js, api/voice-maintenance.js, admin-dashboard.html, vercel.json and browser workflow. Canonical accepted application source is 8133597. Canonical Production record is 6d36aa45; this inspection does not independently refresh Vercel Production. Existing local work/callercore contains unrelated uncommitted voice/website work: use this separate checkout and never copy its working changes over remote head.

Static HTML/JavaScript and CommonJS Vercel APIs are established. Upstash Redis is already used through lib/kv.js, which fails closed when Preview isolation credentials are missing. Existing configuration Lua compare-and-set and audit transactions are useful patterns, not a generic agent queue. Existing voice recovery is scope-specific, uses leases and bounded reconciliation, and has a separately authenticated QStash schedule. Do not reuse its credential, keys, endpoint or schedule for agents. No general agent runner or Agents SDK dependency is installed. Existing Core Intelligence is request-scoped and confirmation-oriented; AI Phone Assistants directory means telephone assistants, not software workers.

Auth revalidates stored membership/session versions; api/account.js requireAdmin also checks current admin identity. Future Agent Operations must reject admin client impersonation and ordinary tenant owners. Existing audit helper trims history to 200 records: agent execution audit needs separate durable retention and export, not silent truncation.

Known industry imagery and Growth overlap are owner-reported candidate defects. Neither is independently reproduced in this architecture checkpoint. Existing 1,891-test/Browser QA evidence cannot establish human visual acceptance. Voice work has its own simulation budget and unresolved telephone acceptance; that budget does not authorize Agent Operations.

## Proposed components and flow

TJ → existing internal admin session → Agent Operations API → durable task/outbox → bounded worker → Chief of Staff → website specialist → independent reviewer → Chief of Staff reconciliation → admin report.

The Chief of Staff keeps ownership of the owner response and calls specialists as tools. The worker, rather than the model, owns scheduling, permissions, budget reservations and state transitions. Separate independent QA execution reads immutable evidence without the specialist's mutable conversation. Initial roles only: chief-of-staff, website-visual-qa, independent-qa. Future roles register versioned responsibilities/tool policies without changing queue architecture.

| Component | Responsibility | Phase 1 boundary |
| --- | --- | --- |
| Admin API | Current membership, CSRF/origin, rate limits, enqueue/read/cancel | Preview internal admins only; no arbitrary workspace selector |
| Task store | Atomic idempotency, transitions, events, lease fencing, approvals, budgets | Dedicated agentops:v1 namespace; no customer records |
| Worker | Claim one stage, heartbeat, invoke agent adapter, persist result | Separate process/job; no browser/tab dependency |
| Chief of Staff | Delegate, reconcile failures, report verified scope | Cannot grant authority or mark code integrated alone |
| Website specialist | Inspect rendered exact Preview and propose bounded patch | Screenshot evidence required; no provider/billing credentials |
| Independent QA | Fresh render and acceptance decision | Different execution identity; rejection returns bounded rework |
| Tool broker | Validate target/action/credential/approval immediately before action | Deny unknown tools and all Red actions in initial release |

## Runtime evaluation

[OpenAI Agents SDK](https://developers.openai.com/api/docs/guides/agents/sdk) runs in our application and leaves deployment, tools, state and approvals under application control. [Agents as tools](https://developers.openai.com/api/docs/guides/agents/orchestration) matches the manager-retains-reply requirement better than transferring the owner conversation. SDK tracing is useful but is not the task ledger. [Human review](https://developers.openai.com/api/docs/guides/agents/guardrails-approvals) supports paused execution; application authorization must still gate the actual tool.

[Managed Agents API](https://developers.openai.com/api/docs/guides/agents-api/overview) is an alternative managed harness with sessions/sandboxes. Account entitlement, sandbox isolation, permitted models and full pricing require validation before choosing it. [Responses background mode](https://developers.openai.com/api/docs/guides/background) handles an asynchronous model response, not our complete multi-step queue, repository lifecycle or approvals.

[eve](https://eve.dev/docs/getting-started) is a viable durable TypeScript framework; adding its runtime to this established CommonJS product would expand deployment/state assumptions. Prefer an isolated worker with an OpenAI SDK adapter as a proposal, leaving the current product stack intact. No framework was installed. Revisit eve/Workflow if managed durable hosting is selected; do not maintain two competing durable state engines.

Existing Work chats are human-facing conversations, not worker processes we can control through the OpenAI API. Supported ChatGPT integrations or workspace agents would require their own supported interface, authentication and authorization. Codex scheduled wakeups are separate from application execution and should not become its queue or approval authority.

## Persistence and recovery

Task: id, owner principal, objective, priority, authorized scope, starting SHA, immutable Preview origin, allowed file paths, dependencies, assigned role, status, revision, attempts, progress digest, timestamps, cancellation, budget reservation, usage, artifacts, verification, approval reference and final handoff.

Statuses: assigned, running, implementation_complete, verification_pending, verification_failed, verified, integrated, owner_accepted, released, blocked, failed, cancelled. A model cannot select integrated/owner_accepted/released. Integration is recorded only after expected-head comparison and exact commit/hosted checks; owner acceptance is a separate trusted event.

Proposed Redis keys use a common {agentops-preview} hash tag if cluster deployment is introduced: task:<id>, events:<id> stream, ready sorted set, idempotency:<principal>:<digest>, lease:<id>, daily/monthly budget counters, outbox:<id>. Creation + index + event + idempotency must be one Lua transaction. Claim atomically increments a fencing token and reserves cost; completion/heartbeat require matching token and unexpired lease. Server time, not model timestamps. Read back uncertain writes; do not blindly rerun tools.

Reaper recovers expired leases to a reconciliation stage. An external call with uncertain outcome becomes blocked until provider response/artifact identity is reconciled. At-least-once delivery does not imply exactly-once side effects. Persist provider execution IDs before polling and tool idempotency receipts before retry. Cancellation revokes future tool access, cancels provider work where supported and preserves consumed/unresolved cost. Never refund an uncertain reservation automatically. Approval pause releases worker occupancy but preserves state and reservation policy. No TTL on unresolved task/audit state; retention/export must be approved separately.

## Worker and repository isolation

First executable pilot should be a manually dispatched, bounded GitHub Actions job with contents:read, fixed inspected commit, exact Preview, short timeout and private artifacts. This reuses existing CI infrastructure, runs independently of chat, and creates no recurring schedule. Account included minutes and artifact quota are not yet verified. Browser dependency installation and screenshots are already established here. Every worker checks the environment and ledger before executing. Long-term use a dedicated worker or a managed durable runtime after cost/permissions review. [Vercel Functions have finite durations](https://vercel.com/docs/functions/limitations); HTTP handlers should enqueue/respond, not host an unlimited coding loop.

Initial inspection tools: fetch fixed allowlisted Preview routes, render at 1440/768/390/320px, save screenshot hashes and structured findings, propose a patch artifact. Browser egress/proxy must block loopback/private/link-local addresses, arbitrary redirects and Production; exact origin binding and protected-Preview bypass stay in the broker. Browser sessions must contain no customer/admin cookies. Authenticated product QA uses dedicated fixtures later.

Only subsequent approved write capability may apply patches in a disposable checkout with no production secrets. Scope paths exclude auth, billing, voice, workflows, package scripts and deployment config. No arbitrary shell tool with inherited credentials. Run untrusted project code in an isolated environment. Independent QA checks a fresh checkout of the proposed commit. Integrator compares branch head with task starting SHA, reconciles newer voice/website work, and never force-pushes or merges main. One integration lock and narrow path ownership prevent simultaneous conflicting changes. No new GitHub write permission is enabled by this scaffold.

## Security and approvals

Default disabled, Preview-only, internal-role check at API and each tool. Separate worker identity/credential; no general admin session, Stripe/Vapi keys or unrestricted Redis token in the sandbox. Storage broker holds database credentials; worker receives task-scoped capability bound to task ID, lease, action, target and expiry. Capability cannot mint approvals. Red operations are absent from initial tool registry, so even forged approval text cannot execute them.

Yellow actions pause for coordination. Future Red approval must be a TJ-authenticated event bound to exact action parameters/hash, revision, target, expiry and one-time execution receipt. Changed parameters require a new approval. A specialist, webpage, repository file or tool response cannot confer authorization. Model output is schema-validated untrusted data; never interpolate it into commands. Escape output in UI, redact credentials/PII before trace/artifact storage, keep operational data outside tenant exports. Require independent review for security/data integrity changes. No legal/compliance claim generation in the initial toolset.

## Costs and models

Scaffolding/offline tests spend $0 on model APIs. Proposed approval for a later pilot: ONE bounded inspection/review, $2 maximum total model/tool usage, at most 6 model calls, 10 minutes execution, 2 specialist attempts, 1 independent-review attempt per result, no recurring jobs, no purchases/autoreload. This is a proposal, not authorization. No existing voice simulation allowance transfers. Stop before any call whose reserved worst-case cost would exceed task/daily/monthly limits. Unknown price/model/tool rate fails closed; include reasoning tokens where billed, screenshots/hosted tools and abandoned calls. Concurrent reservations must be atomic across task/day/month, with unresolved calls retaining reservations. Hard invoice-level limits depend on provider controls; local estimates alone cannot guarantee an invoice cap.

Configure an API-model allowlist with verified account access and pricing snapshot. Work labels such as GPT-6.1 Sol Light are not API IDs. Use supported low/medium/higher settings only after validating the selected model's capabilities. Website routine stages default low, manager/reviewer medium, deeper security review requires separate bounded authorization. Record resolved model/effort, pricing version, tokens, duration, tool usage and estimates per execution. Escalate after three distinct same-defect fixes or two cycles without changed evidence; regression pauses edits. Duration alone is not evidence of a stall. Initial scaffolding enforces a bounded lifecycle but does not execute models or account usage.

## Admin UI concept

Add a distinct Agent Operations view to the existing admin dashboard after the API/store are verified. Show persisted counts, queue, running lease/heartbeat, pending approvals, blockers, budget reserved/consumed/unknown, last refreshed/error state. Directory shows the three configured roles, runtime version and enabled tools; configured is not running. Task detail shows objective, exact SHA/Preview, events, artifacts, independent decision and integration/owner acceptance separately. Initial actions: submit bounded inspection, refresh, cancel. Omit Start/Approve/Release until real server paths exist. Do not expose operational records in client bootstrap or AI Phone Assistants.

## Phases and acceptance gates

1. This checkpoint: architecture, pure safety/lifecycle kernel and behavioral tests, no routes/UI/provider calls. Offline fixtures explicitly are not actual delegation or durable recovery evidence.
2. Durable Preview broker: atomic task/idempotency/lease/event/budget tests against disposable Redis, authenticated internal admin read/create/cancel API and persisted UI. Confirm role revocation, client-impersonation denial, CSRF, pagination, no cross-tenant paths, concurrent claims and audit failure behavior.
3. After pilot budget/runtime approval: SDK Chief of Staff → real screenshot specialist → independent reviewer → persisted reconciled report. Inject rejection and cancellation. Demonstrate restart while running, stale fencing denial, unknown-call reconciliation, lease recovery, cost exhaustion and denied Red tools. Evidence must include task/execution IDs, exact screenshots and fresh independent decision.
4. After separate external-write authorization: scoped patch sandbox and guarded integration into feature branch, full applicable tests/CI/CodeQL/exact hosted QA, owner visual acceptance. No main merge or Production release.

Phase 1 completion requires ALL original acceptance criteria demonstrated, including real programmable delegation, persisted admin state, interruption recovery and real rendered defect evidence. It is not complete at this scaffolding checkpoint.

## Risks and remaining decisions

No current account API entitlement/pricing/worker quota verification. Existing Redis capacity and ACL granularity need inspection before connecting the broker; no broad credentials should enter workers. Managed services may add costs, and no paid service is provisioned. Browser vision can miss contextual imagery; use explicit industry-content and badge-overlap criteria plus owner review. Worker tool scope is the critical boundary; prompts alone cannot secure arbitrary shell/network access. SDK/runtime version must be pinned and reviewed before installation. Current Production and concurrent workstreams remain untouched.
