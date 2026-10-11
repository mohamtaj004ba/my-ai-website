# Agent Operations diagnostic review

The original Chief failure may remain permanently unprovable. Its exception and provider metadata were discarded. These changes improve observation of a future execution; they do not establish or repair a proven historical provider error. No new inference request is authorized by this document.

## Reviewed path

Internal admin or the one-use owner approval creates a durable task pinned to the existing Legal/Growth scope. The trusted parent assigns exactly one task to a fixed restricted worker. Revision, fencing, lease, deadline and approval checks precede a pessimistic reservation. The adapter rechecks approval, sends one fixed Responses request, validates the approved model, usage and bounded output, then submits a fenced completion receipt. Only the store advances Chief → Website Visual QA → Independent QA → Chief report. Models cannot choose targets, tools, credentials, limits or transitions.

Credentials remain separated: the parent holds Preview authentication and broker authority; a paid worker could receive only the dedicated OpenAI project credential. Mock workers receive no model credential. Paid execution remains disabled locally and on Preview. No Production credentials, protection changes or expanded provider permissions are required.

## Retained evidence

Every provider attempt has a reserved execution identity. Bounded sanitized checkpoints preserve dispatch intent, HTTP status/request ID when available, response ID/status, elapsed timing and observed usage. Dispatch intent is unknown until fetch entry; a confirmed pre-fetch failure is recorded as not attempted. The execution identity is also the fixed `X-Client-Request-Id`, enabling future provider correlation even if no server request ID returns. See [OpenAI request debugging](https://developers.openai.com/api/reference/overview).

Only fixed error classes/codes, constrained identifiers, bounded numeric fields and booleans survive sanitization. Raw error messages, prompts, screenshots, response bodies, headers and credentials are excluded from diagnostic receipts. Provider status and broker status are separate. Broker budget, state and storage denials retain their safe classifications through the actual parent/child IPC boundary.

The parent writes a bounded ignored local fallback journal before forwarding evidence and failure commands. The worker sends a safe failure notice before rereading the broker. This preserves already observed facts when cancellation, approval revocation or broker outage prevents a final ledger write. Child termination is recorded against the last known execution. Simultaneous parent/worker/storage loss can still leave only the last durable checkpoint; missing facts remain unknown.

## Accounting and controls

Settled ledger receipts, validated but unsettled observed usage, and unverified/unknown usage remain distinct. Diagnostic usage never automatically settles or releases a reservation. Output rejection, cancellation, interruption, timeout and uncertain persistence retain the pessimistic ceiling. A confirmed CAS conflict may retry storage comparison; there is no automatic provider-request retry or uncertain execution replay.

Evidence commands require an existing pending reservation and matching task, execution, stage, fence, lease and deadline. They cannot create tasks, spend, settle, release, retry, cancel or advance a stage. Existing task, daily and monthly ceilings remain unchanged. Parent-journal capacity failure prevents dispatch rather than silently sacrificing evidence.

The original paid task retains its $0.30 reservation. Actual historical cost is unknown. Synthetic hosted testing also demonstrated that existing mock allowance limits stop further stages; those allowances were preserved rather than reset. Mock allowances are separate from paid allowances.

## Recommendation after exact-source hosted checks

A separately authorized second pilot is technically reasonable as a bounded diagnostic experiment once the canonical handoff records successful final-source CI, security and Preview checks. It would test the real provider path, which offline mocks cannot prove. It would not explain the original failure retroactively.

Retain the dedicated CallerCore Agent Operations project, `gpt-4.1-2025-04-14`, pinned application source `8133597ff2fc5b48e3de42336e9e06fa4191c2a8`, read-only Legal/Growth scope, ten-minute deadline, six-call hard maximum, $2 task ceiling, one-use expiring approval and immediate re-disablement. Expect four model calls for the accepted workflow, with no automatic provider retries or additional tasks.

The retained $0.30 leaves $1.70 in the current $2 paid daily/monthly reservation allowance. With $0.30 reserved per call, at most five additional calls can reserve before an existing cumulative gate stops execution. Four expected calls require $1.20; the original hold plus five additional reservations totals $1.80. A sixth new reservation would exceed the unchanged cumulative ceiling and must fail closed. Do not promise six usable calls, release the original hold, or increase a limit to make a pilot fit.

Acceptance should require separate specialist and independent QA executions, fresh pinned screenshots, persisted outcomes, provider/client correlation and timing, validated token usage, conservative settlement accounting, no unauthorized requests, and verified `paidExecution=false` after completion or failure. Fresh explicit human authorization, configuration read-back and the verified shutdown procedure remain necessary before any live attempt.
