# CallerCore project state

Updated: 2026-09-25. Resume here, then inspect current Git refs and deployments. This record distinguishes inspected code, automated verification, and provider-complete acceptance. Never treat a historical checklist as current deployment evidence.

## Project and architecture

CallerCore is an AI front office for service businesses, with a public acquisition site, managed onboarding, client workspace, and owner/admin operations dashboard.

- Repository: `mohamtaj004ba/my-ai-website`.
- Development: `feature/callercore-dashboards`; production: `main`.
- Static HTML/CSS/JavaScript, not Next.js. `dashboard.html`, `admin-dashboard.html`, `dashboard.js`, `dashboard.css` supply the dashboards.
- Vercel Functions under `api/`, shared modules under `lib/`; primary account dispatcher is `api/account.js`.
- Upstash Redis via `@upstash/redis`; Preview isolation implemented in `lib/kv.js`.
- Stripe billing, Mailgun lifecycle email, admin-only Gmail OAuth, Anthropic-assisted onboarding are present. Provider-complete launch verification remains separate.
- Voice/Vapi is a dedicated unfinished workstream. Do not imply live telephony from seeded dashboard data.

## Current development pass — 2026-09-25

COMPLETED AND VERIFIED within the coverage below: truthful voice readiness; atomic receptionist, Settings and admin phone configuration saves; conflict-safe legacy configuration mutations; atomic audit-history append; stale-edit/capacity guards; pending-save locks; background-refresh and logo-processing draft protection; admin phone search/filter/batching; responsive routing cards and reachable editor actions; bounded Conversations and contact-history rendering.

This is a dashboard and shared-backend checkpoint, not provider activation or production release. The detailed entries below preserve findings, failures, corrections and verification history.

## Latest verified implementation checkpoint

- Implementation SHA: `849bad8cabe1fd9606c6e5e43643c04bd9daf21d`.
- Preview READY: `dpl_GqT6JQ53dn2MvxY3WNt1dHsAFiXa` — https://my-ai-website-kl6lrkoen-mohamtaj004bas-projects.vercel.app
- CallerCore CI `36118779489`, CodeQL `36118779413`, Jekyll `36118779437`: success on that exact SHA. Push CI `36118775231` and CodeQL `36118775270` also passed.
- Authenticated Preview Browser QA `36118775247`: success on that exact SHA.
- Local regression suite: 215 passed, 0 failed. JavaScript syntax and diff checks passed.
- Browser report: 1,200 calls, 153 conversations (including a 122-message history), 11 admin clients; zero page/console/API errors; 25 layout checks.
- Covered interactions include receptionist identity/transfer saves and restoration, routing synchronization, Settings save/readback/restoration, pending-save locks, background-refresh draft protection, logo preparation/cancellation, admin phone search/save/restoration, legacy restore/delete safeguards, and 50 → 100 → 122 message batches in Conversations and Contacts.
- Responsive client/admin checks at 1280, 768 and 390 pixels include opening/closing phone editors and reaching Save without submitting responsive-test changes.
- Visual inspection: inventory laptop/tablet/mobile screenshots and mobile phone editor reviewed. Transfer/after-hours text is separated, actions remain visible, and Save is reachable inside the scrolling modal.
- This documentation-only follow-up records the verified implementation; it does not claim a browser run against its own future commit.
- Production/main rechecked unchanged at `37ef5cfcdccae35952822859f64fe83f0b9f09f0`. No production release, customer communications, billing changes or provider activation performed.

## Verified starting checkpoint

Read-only inspection on 2026-09-25 confirmed:

- Development SHA: `fa6039e38384169aac88becabe1ac5ffc61888b9` — Exercise polished Follow-ups actions in Preview QA.
- Main SHA: `37ef5cfcdccae35952822859f64fe83f0b9f09f0`.
- Development 977 commits ahead, 0 behind main; fresh local checkout clean.
- No newer changes on the designated development branch relative to the handoff. Other sessions' unpushed workspaces were not available for inspection.
- PR [#5](https://github.com/mohamtaj004ba/my-ai-website/pull/5) remains open and draft. Its body references an older checkpoint and is not the current QA record.
- Preview `dpl_2Z5hciVB3Wtm9PJSXhZLjcjxFjRA` is READY at this SHA: https://my-ai-website-lv1hnqccv-mohamtaj004bas-projects.vercel.app
- CallerCore CI, CodeQL, Jekyll: success on this SHA.
- Authenticated Preview QA run `36103929249`: completed/success on this SHA (queried through GitHub Actions API).

## COMPLETED AND VERIFIED

At the starting checkpoint, recent Calls, Contacts, and Follow-ups passes exist in code and the exact-head CI/Preview QA above passed. This verifies covered workflows, not every product claim or external integration.

Current verified implementation: 215/215 local tests pass. Executable regressions cover tenant-scoped conversation pages, 125-thread/1,000-message rendering, contact history batching, save/refresh/upload races, stale snapshots, transaction failures, metadata preservation and Settings read/write revision consistency; the latest full Preview acceptance is above.

## IMPLEMENTED BUT NOT FULLY VERIFIED

- Existing customer areas: Overview, Calls, Contacts, Conversations, Follow-ups/Leads, AI Receptionist, routing, locations, automations, analytics, integrations, billing, settings, support. Entitlements and runtime flags determine visibility.
- Existing admin areas include client operations, calls, agents, Gmail/website inbox, prospects, analytics, revenue/usage, provisioning, phone numbers, support, health, platform settings.
- Existing auth/tenant isolation, session revocation, read-only admin client view, agreements, export/redaction, audit and recovery safeguards have regression coverage. Full security assurance is not established by automated tests alone.
- First Conversations scaling pass: 50-thread batches, counts, activity sorting, Closed filter, clear filters, accessible selected states, bounded responsive list, long-message wrapping, stale empty-result cleanup. Preview READY for Conversations implementation `871970346cd44cca7544f3d6163c134538f6c683` (deployment `dpl_G6Deu1YVnjFj6KWiNrQc29ANZ3xs`). Conversations authenticated QA run `36108934848` passed with 153 conversations, 1,200 calls, and no console/page/API errors. Combined forms run `36109277532` passed interactions but exposed a pre-existing Settings overflow at 768px. Settings grid/field containment corrected; run `36109630708` passed laptop/tablet including Settings. Mobile follow-on navigation exposed a QA helper error: CSS-visible off-screen sidebar links were mistaken for accessible links. Helper now opens the collapsed mobile menu before navigation; full rerun `36110012998` passed.

## Next authorized development backlog

1. Design storage normalization and migration for the legacy tenant conversation array; do not rewrite existing records in place without a reversible migration and compatibility read path.
2. Continue client/admin shared-state consistency and accessibility review using the existing authenticated Preview workflow and screenshots. Current regression coverage is not a claim that every dashboard action has been tested.
3. Inspect provider/billing test-environment readiness before dedicated voice lifecycle, disposable onboarding and Stripe test-mode/recovery scenarios. Live activation, production changes and new charges still need owner authorization.

## Known limitations and remaining work

- Conversations currently reads a tenant-scoped KV array via `requireFeature(...,'unifiedInbox')`; full data still transfers to the client. Rendering batches are not server pagination.
- Client Conversations is a history viewer. No client reply composer or shared unread state was found. Do not invent working messaging or change SMS launch scope to expose it.
- Conversation records link to derived contact history; admin Gmail/website Inbox is a separate data source. A shared client/admin message-delivery pipeline has not been verified.
- Live voice remains unavailable: shared readiness now reports awaiting activation; fake pause/resume is blocked. A real provider adapter and verification remain required before activation.
- Contact-drawer and Conversations rendering use 50-item/message batches. The dashboard bundle now carries message-free contact summaries; individual thread and contact histories load on demand.
- Some release docs predate implementation: README's unlimited Pro statement corrected; environment matrix/DEPLOY contain historical isolation and QA notes; production readiness still describes the already-replaced `@vercel/kv` client. Use actual code and current evidence.
- Older rollback deployment references are historical and differ from current main SHA. Re-verify the appropriate production rollback target before an authorized release.

## NOT STARTED / dedicated remaining work

Receptionist/Settings persistence, conflict handling, pending-save, background-refresh and logo-processing fixes are verified above. Provider lifecycle implementation/acceptance remains a separate workstream.

Roadmap: production voice lifecycle; provider-complete disposable onboarding; Stripe test-mode subscription/payment/recovery scenarios; provider restore drill; logging/privacy and release review. Check actual implementation before marking any historical roadmap item not started.

## BLOCKED

Commercial release remains blocked on dedicated provider validation and owner decisions. Routine Preview dashboard development is not blocked.

## OWNER DECISION REQUIRED

Legal entity/business registration and Washington tax treatment; minute overage and Pro fair-use policy; SMS/calendar scope and provider readiness; final legal review; final production release and checkout activation. See `docs/TJ_DECISION_BACKLOG.md` for details, reconciling older completed items first.

## Product decisions to preserve

- Premium, understandable operational UI; explicit Edit/Save/Cancel states; meaningful loading/empty/error states; mobile and keyboard usability.
- Call type, AI disposition, and team status are separate. Capturing a request does not mean the business completed it.
- AI dispositions: Resolved by AI, Request captured, Message taken, Transferred, Escalated, Incomplete, Non-customer call.
- Team statuses: No action needed, Needs action, In progress, Completed, Dismissed.
- Growth/Pro unified Conversations access; do not rewrite plan permissions.
- No fabricated metrics, fake green health, or implied operational providers.
- SMS/calendar remain gated until dedicated readiness/approval. Gmail remains admin-only.
- Preserve signed agreements, accepted commercial terms, and approved retention periods.

## Production restrictions

Only commit/push routine changes to the authorized development branch. No merge into main, production deployment, DNS/routing changes, production record mutations, live checkout/billing, live customer numbers, destructive tests, or customer-facing communications without explicit approval. Never disable protections for QA or expose secrets.

## Verification and continuity workflow

- `npm ci --ignore-scripts`; `npm test` (Node regression tests); build also runs tests.
- `.github/workflows/callercore-ci.yml`, `codeql.yml`, `jekyll-docker.yml`.
- `.github/workflows/preview-browser-qa.yml` automatically runs on feature pushes, waits for Vercel, exercises disposable authenticated client/admin workflows, captures responsive screenshots/errors, uploads reports.
- `scripts/preview-browser-qa.mjs`; `scripts/visual-diff.mjs`.
- QA secrets stay in GitHub Actions. Do not copy their values into docs/chat.
- At each meaningful checkpoint record source SHA, deployment, tests actually run/results, limitations and next task. A documentation-only follow-up may reference the last verified implementation SHA rather than claim self-verification.

## Supporting documents

`README.md`, `DEPLOY.md`, `docs/FINAL_PRELAUNCH_AUDIT.md`, `docs/PRODUCTION_READINESS.md`, `docs/TJ_DECISION_BACKLOG.md`, `docs/DATA_RETENTION_POLICY.md`, `docs/BACKUP_AND_RECOVERY.md`, `docs/DATA_RECOVERY.md`, `docs/INCIDENT_RESPONSE.md`, `docs/ENVIRONMENT_SCOPE_MATRIX.md`, `docs/ANALYTICS_ROLLUP_DESIGN.md`, `docs/VOICE_UNIT_ECONOMICS.md`.

## Verified voice/configuration checkpoint and admin inventory follow-up

- Implementation `ddf184f5850d73b8634bf377abb44a662dd1ddd3`: 171 local tests passed; CI, CodeQL, Jekyll and authenticated Preview browser QA run `36112569864` passed. The QA includes real receptionist identity and transfer saves/readback/restoration in the isolated test workspace, exercising the atomic configuration transaction.
- Admin phone inventory now has search, assignment filters, result counts, 50-record batches, reset and empty states. Stale edits, missing edited records, malformed inventory and the 500-record capacity are rejected before mutation. Existing admin multi-record persistence is not yet an atomic transaction.
- Added behavioral tests for inventory pagination/search and backend save guards; 175 local tests passed. Added Preview admin phone label save/readback/restore and responsive phone checks; these new checks await the next feature push.
- Next: prevent edits/cancellation/navigation while client saves are pending, then verify the expanded admin Preview checks.

## Shared form persistence and race protection

- Admin inventory implementation `8db84a6c75f21ec5f0fa366d470bf0a597235527` passed CI/CodeQL/Jekyll. Preview QA `36113094987` failed at the new phone-save check because two primary Preview fixtures shared `(509) 555-0188`. The existing duplicate-number guard correctly rejected the edit. Screenshot and report reviewed; seed primary numbers now use stable workspace-specific fictional 555-01xx values. No production data changed.
- Client receptionist and Settings forms now lock editable controls/cancellation during pending saves, prevent duplicate submissions and guard navigation. Clicking the current navigation item no longer resets an open draft. Failure keeps the draft available for correction/retry.
- Settings writes now compare revisions and atomically commit settings plus workspace display fields; conflicts return 409 and ambiguous storage failures return 503 without claiming success. Plan and existing owner metadata remain intact.
- Added executable pending-request, failure, navigation and Settings transaction tests, plus Preview pending-save assertions and Settings save/readback/restore. Local verification: 184 tests passed, JavaScript syntax and diff checks passed. Expanded Preview verification pending the next feature push.

## Admin routing transaction and Settings read-contract correction

- Preview QA `36113572790` on `f8fdaaa0d1febf9211961983b1b9f461add0b579` exposed a missing Settings revision in both settings read responses. Saves failed closed with 409, preserving the draft. Both read paths now expose the saved revision, with executable regression coverage.
- Admin phone saves now stage inventory, target/previous workspace phone fields, onboarding assignment checkpoints, and changed target agent/routing-request transfer values in one atomic compare-and-set operation. Concurrent modifications reject the entire save; ambiguous failures no longer attempt a rollback that could overwrite another writer. Label-only updates avoid touching unchanged agent configuration.
- Phone modal inputs and dismissal/navigation are locked during save; duplicate submissions are ignored. Preview QA now checks this pending state.
- Local verification: 188 tests passed; expanded tests cover reassignment snapshots, metadata preservation, conflict/failure handling and read/write revision consistency. Preview verification pending feature push.
- Legacy phone deletion still uses its existing rollback path and is not exercised against real records. It remains a dedicated follow-up, along with other older admin configuration writers.

## Conversation message scale and immediate admin save consistency

- Preview QA `36113937135` on `68be8f8b5262726d40677fe64ed4766bc9fd54e0` verified all client persisted-save and pending-lock checks with no API/page errors. It exposed an admin UI race: the phone modal closed before inventory refresh finished, allowing an immediate reopen with stale data. The save now applies the server-returned record/revision locally before closing; an executable delayed-refresh regression covers it.
- Long Conversations threads now initially render the latest 50 messages, provide earlier-message batches/counts, reset limits when selecting another thread, and preserve scroll position while loading earlier history. Full history still transfers from the API; this is rendering pagination.
- Added a 1,000-message unit fixture and a 122-message fictional Preview seed thread. Authenticated QA checks 50 → 100 → 122 messages and selection reset.
- Local suite: 190 passed; syntax/diff checks passed. Latest changes await feature Preview verification.

## Background refresh draft protection

- Found a second client draft-loss race: a refresh begun before editing could apply its response after a draft was opened or saved. Refresh now captures an edit generation, rechecks it after the request, and defers stale responses. Explicit refresh leaves open drafts intact and directs users to save/cancel first.
- Added deferred-response regression tests for an open draft, a completed newer edit, and normal refresh. Authenticated Preview QA now holds a refresh response, opens/edits a receptionist draft, then verifies the released response preserves it.
- Local suite: 193 passed, 0 failed. Syntax check passed. Preview verification pending.

## Verified expanded dashboard checkpoint

- Implementation `4c0d7ab715e3fb4836e839a8d785dfab632cf79c`: 190 tests passed locally; CI `36114279107`, CodeQL `36114279055`, Jekyll `36114279103` passed. Full authenticated Preview QA `36114274239` passed, including client and admin persisted-save/restore, pending-save locks, long message batches and laptop/tablet/mobile layouts.
- Preview READY: `dpl_iDTBVDLoqfDGy4JowpPgPitZW8Ad`, https://my-ai-website-6d1soigps-mohamtaj004bas-projects.vercel.app .
- Next queued implementation is the background-refresh draft guard (193 local tests); it still requires its own expanded Preview run.

## Screenshot-driven phone inventory usability correction

- Reviewed the successful `4c0d7ab` run's laptop/tablet/mobile screenshots and clean report (1,200 calls; 153 conversations; 11 admin clients; zero API/page/console errors; 22 layout checks). Visual review found inherited table styles hid phone edit actions at tablet/mobile widths, despite passing overflow checks. Desktop headers also inherited a wider minimum width than their rows.
- Narrow phone tables now use scoped card rows with visible workspace, routing, readiness and Edit/Delete actions; mobile count cards use two columns. Desktop phone headers use the actual container width. Added responsive QA that opens/closes the phone editor and captures it at laptop/tablet/mobile sizes.
- Phone modal opening is explicitly blocked while its save is pending. Local suite remains 193 passing. Visual verification pending feature push.

## Settings logo preparation race protection

- Background refresh guard `0188635bf5a14933357d7c76be5df5db17c2cfe8` passed authenticated Preview QA `36114650092`, including the held-response draft test.
- Settings image preparation now disables Save until processing completes, ignores canceled/superseded requests, preserves the existing logo on processing errors, and prevents a late image from replacing a newer draft. Removing/canceling a logo invalidates pending work.
- Added deferred image-processing tests and real browser file preparation/cancel coverage (no saved logo mutation). Local suite: 196 passed. New browser coverage pending Preview verification.

## Phone editor visual acceptance follow-up

- Implementation `437d2fdf3e61c696b2fcedce328d8f3da38e0ea3` passed full Preview QA `36114960190`, CI/CodeQL/Jekyll, with 25 layout checks and zero API/page/console errors. Reviewed tablet inventory and mobile editor screenshots: Edit/Delete actions are visible and editor controls fit their container.
- One small visual refinement separates transfer destination and after-hours text into distinct lines. Responsive QA now also scrolls to Save and asserts it is reachable within the viewport; it does not submit changes during responsive checks.
- Remaining backend hardening: older admin restore/delete writers and audit append concurrency still use legacy paths. Settings/agent/admin phone config snapshots are atomic, but audit append remains a separate step. No claim of complete transactional audit coverage.

## Final combined verification record

The implementation at `aadccad3a40368bf05b78a0b72d027135340e3a8` passed the full combined workflow described at the top of this record. Earlier pending/failure entries are historical and resolved by this checkpoint except where explicitly listed in the remaining backlog. Progress was recorded after each substantive change; all work remains on the authorized feature branch.

## Atomic legacy configuration mutation batch

- Phone deletion now validates the displayed record revision and atomically removes the inventory item while clearing the matching workspace phone and onboarding assignment checkpoint. Concurrent changes return 409; ambiguous storage failures return 503 without an unsafe rollback.
- Admin configuration overrides and audit snapshot restoration now stage their primary record plus derived workspace name or agent routing records in one compare-and-set transaction. Agent restores cannot partially update the phone inventory or routing request.
- Audit history now prepends and trims through one Redis Lua operation. Concurrent audit events no longer use read/modify/write and cannot silently overwrite one another; malformed stored history fails closed.
- Added behavioral transaction tests for phone deletion, admin agent override/restore, derived state, stale/conflicting writes, malformed inventory, local delete consistency, and 250 concurrent audit appends. Local verification: 202 tests passed; JavaScript syntax and diff checks passed.
- Configuration state and its audit event are still separate Redis operations. The state transaction completes before audit append; a dedicated transactional audit/outbox design remains future work if strict all-or-nothing audit persistence becomes a launch requirement.

## Contact history scale batch

- Contact drawers now render activity in 50-item batches with visible counts and incremental loading. Changing contacts or activity filters resets the batch and per-session state.
- Long message sessions inside contact history show the newest 50 messages and load earlier messages in 50-message batches while reopening the active session. The existing Conversations timeline and contact link behavior are preserved.
- Malformed conversation message collections are ignored instead of crashing contact aggregation.
- Added executable 125-activity and 1,000-message contact history tests. The isolated Preview seed now keeps its 122-message history in one contact session, and authenticated QA verifies 50 → 100 → 122 loading through the contact drawer as well as Conversations.
- Local verification: 206 tests passed; JavaScript syntax and diff checks passed. Full authenticated Preview QA `36117566334` and all CI/CodeQL/Jekyll gates passed on implementation `e6e5034fe3ae437a7504accfdc6962c614a0410c`.
- The underlying tenant conversation array still loads from KV as one record. This batch bounds browser rendering; API payload pagination remains the next scale task.

## Tenant-scoped conversation pagination API batch

- Added bounded conversation list pages with newest/oldest sorting, exact Active and Closed filters, follow-up attention filtering, full-history search, stable query-bound cursors, 100-record maximum pages, and message-free summaries.
- Added authenticated per-thread detail and newest-first message-page routes. Message cursors walk backward without duplication and cannot be reused for a different thread.
- Every route derives the conversation key from the authenticated session workspace and preserves the unified-inbox entitlement check; request-supplied workspace IDs are never used.
- Malformed stored conversation arrays fail closed. Invalid, oversized, expired or query-mismatched cursors return a bounded client error instead of resetting silently.
- Added executable pagination, cursor, filter, full-history search, malformed-message and tenant-scope regressions. Local suite: 212 passed; syntax and diff checks passed.
- This layer bounds API responses but still reads the legacy tenant array internally. A separately designed storage normalization/migration remains a later scale step.

## Dashboard conversation pagination integration

- The client dashboard bundle now includes a precomputed first conversation page. Subsequent Load more, newest/oldest sort, attention/active/closed filters and full-history searches use the tenant-scoped page endpoint.
- Page changes keep complete conversation data available to Contacts, while the Conversations list renders only returned summaries. The UI reports server totals, disables duplicate page loads and discards superseded search/filter responses.
- Background refresh replays a non-default active conversation query after applying the latest workspace bundle, so refresh cannot silently replace filtered results with the default page.
- Summary-only fallback data hydrates the selected thread through the authenticated detail route before rendering messages. Contact counts use server message counts when a full message array is not present.
- Preview QA waits for asynchronous page results during load-more, sort, search, reset and attention-filter checks. Local verification: 215 tests passed; syntax and diff checks passed.
- This verified checkpoint still carried complete histories in the initial bundle. The subsequent message-free contact directory and on-demand history batch is recorded below and awaits Preview verification.

## Admin configuration mutation state

- Admin configuration overrides and audit restores now lock the section selector, JSON editor, reload/apply controls, restore actions and client-drawer dismissal until the request and refresh complete. Duplicate mutation attempts are ignored.
- Successful responses apply the server-returned sanitized value locally before background admin data refreshes, so an immediate editor repaint cannot show the stale pre-save snapshot.
- Network and API failures unlock the controls while preserving the editable JSON for correction or retry. The drawer exposes `aria-busy` during the operation and buttons show Applying/Restoring progress labels.
- Added behavioral tests for pending locks, duplicate-submit prevention, failure retry state, immediate override/restore consistency and dismissal blocking. Authenticated Preview QA now holds an override request and verifies the lock before releasing the non-destructive same-value Preview update.
- Local verification: 218 tests passed; JavaScript and Preview QA syntax plus diff checks passed. Feature Preview verification pending.

## Message-free dashboard bundle and on-demand contact history

- The initial client dashboard bundle now returns the complete contact/conversation directory as message-free summaries with message counts and activity timestamps, plus the first bounded Conversations page. Message bodies no longer scale the initial payload.
- Selecting a Conversations thread hydrates only that tenant thread. Opening a contact with message history hydrates only conversations whose normalized phone/name key matches that contact, then merges the results into the existing directory without dropping calls, leads or unrelated contacts.
- Contact history requests retain the unified-inbox entitlement check and derive the storage key from the authenticated workspace. Phone formatting and fallback names normalize consistently on both server and client.
- Background refresh clears hydration markers with the refreshed summaries; duplicate contact requests are suppressed, failures show a retry state, and demo data remains local.
- Added executable contact-key, tenant-route, message-free bundle, on-demand merge and duplicate-hydration regressions. Local verification: 221 tests passed; syntax and diff checks passed. Preview verification pending.
- Server reads still scan the legacy tenant conversation array. A reversible normalized-storage migration with compatibility reads remains the next backend scale boundary.
