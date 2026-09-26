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

COMPLETED AND VERIFIED within the coverage below: truthful voice readiness; atomic receptionist, Settings and admin phone configuration saves; conflict-safe legacy configuration mutations; atomic audit-history append; stale-edit/capacity guards; pending-save locks; background-refresh and logo-processing draft protection; admin phone search/filter/batching; responsive routing cards and reachable editor actions; bounded normalized Conversations/contact-history reads; shared modal/drawer accessibility; and stale-response protection for client call details, admin inbox selections and website analytics ranges.

This is a dashboard and shared-backend checkpoint, not provider activation or production release. The detailed entries below preserve findings, failures, corrections and verification history.

## Latest verified implementation checkpoint

- Implementation SHA: `db68806a5eca0b9c3c7d0d635948eb09d09d1056` (marketing campaign create/edit/delete audit atomicity; earlier pending-action, transactional, support and finance safeguards remain present).
- Preview READY: `dpl_7rw4jXRSuMNWyDJr9PDSRwfRFNvM` — https://my-ai-website-36pyty7d6-mohamtaj004bas-projects.vercel.app
- CallerCore CI `36209111116` and `36209108577`, CodeQL `36209111131` and `36209108548`, Jekyll `36209111121`: success on that exact SHA.
- Authenticated Preview Browser QA `36209108644`: success on that exact SHA. Earlier recovery acceptance succeeded on `452ae304` (QA `36179292162`).
- GitHub full CI regression suite at this implementation: 303 passed, 0 failed (`36209111116`); build, JavaScript syntax and diff checks passed. The recovered implementation earlier had 255 locally reported passing tests.
- Earlier authenticated browser report: 1,200 calls, 153 conversations (including a 122-message history), 11 admin clients; zero page/console/API errors; 25 layout checks. This report belongs to the earlier verified dashboard run, not an independently extracted report for `2213219`; the latest QA run is recorded above.
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

Current implementation: 303/303 tests passed in GitHub CI on `db68806a`; the recovered batch also passed CI on `452ae304`. Executable regressions cover tenant-scoped normalized conversation pages and on-demand hydration, 125-thread/1,000-message rendering, contact history batching, admin mutation/drawer/inbox/analytics races, serialized Client Care status writes, client call-detail races, shared dialog accessibility, Stripe environment isolation, save/refresh/upload races, stale snapshots, transaction failures, metadata preservation and Settings read/write revision consistency; the latest full Preview acceptance is above.

## IMPLEMENTED BUT NOT FULLY VERIFIED

- Existing customer areas: Overview, Calls, Contacts, Conversations, Follow-ups/Leads, AI Receptionist, routing, locations, automations, analytics, integrations, billing, settings, support. Entitlements and runtime flags determine visibility.
- Existing admin areas include client operations, calls, agents, Gmail/website inbox, prospects, analytics, revenue/usage, provisioning, phone numbers, support, health, platform settings.
- Existing auth/tenant isolation, session revocation, read-only admin client view, agreements, export/redaction, audit and recovery safeguards have regression coverage. Full security assurance is not established by automated tests alone.
- First Conversations scaling pass: 50-thread batches, counts, activity sorting, Closed filter, clear filters, accessible selected states, bounded responsive list, long-message wrapping, stale empty-result cleanup. Preview READY for Conversations implementation `871970346cd44cca7544f3d6163c134538f6c683` (deployment `dpl_G6Deu1YVnjFj6KWiNrQc29ANZ3xs`). Conversations authenticated QA run `36108934848` passed with 153 conversations, 1,200 calls, and no console/page/API errors. Combined forms run `36109277532` passed interactions but exposed a pre-existing Settings overflow at 768px. Settings grid/field containment corrected; run `36109630708` passed laptop/tablet including Settings. Mobile follow-on navigation exposed a QA helper error: CSS-visible off-screen sidebar links were mistaken for accessible links. Helper now opens the collapsed mobile menu before navigation; full rerun `36110012998` passed.

## Next authorized development backlog

1. Continue client/admin shared-state consistency and accessibility review. Campaign UI actions and multi-record campaign audit atomicity are now verified. Review other operational records, especially admin company-document updates, without reworking this covered scope. Current regression coverage is not a claim that every dashboard action has been tested.
2. Keep the normalized-conversation migration and rollback contract ready for a separately authorized production migration; the existing authenticated Preview workflow now verifies version 2 reads without changing production.
3. Run dedicated voice lifecycle, disposable onboarding and Stripe test-mode/recovery scenarios only when the required provider test configuration is available. Live activation, production changes and new charges still need owner authorization.

## Known limitations and remaining work

- Conversation reads prefer a versioned tenant-scoped summary index and per-thread details, with the untouched legacy tenant array as the compatibility/rollback source. Production data has not been migrated.
- Client Conversations is a history viewer. No client reply composer or shared unread state was found. Do not invent working messaging or change SMS launch scope to expose it.
- Conversation records link to derived contact history; admin Gmail/website Inbox is a separate data source. A shared client/admin message-delivery pipeline has not been verified.
- Live voice remains unavailable: shared readiness now reports awaiting activation; fake pause/resume is blocked. A real provider adapter and verification remain required before activation.
- Contact-drawer and Conversations rendering use 50-item/message batches. The dashboard bundle now carries message-free contact summaries; individual thread and contact histories load on demand.
- Some release docs predate implementation: README's unlimited Pro statement corrected; environment matrix/DEPLOY contain historical isolation and QA notes; production readiness still describes the already-replaced `@vercel/kv` client. Use actual code and current evidence.
- Older rollback deployment references are historical and differ from current main SHA. Re-verify the appropriate production rollback target before an authorized release.
- Admin workspace reads now fetch all entries in concurrent batches of 40, subject to a 2,000-record fail-closed capacity boundary. Before exceeding that threshold, introduce a properly paginated/aggregated backend; do not turn 2,000 into another silent truncation.

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
- Local verification: 218 tests passed; JavaScript and Preview QA syntax plus diff checks passed. Full authenticated Preview QA `36119141579` and all CI/CodeQL/Jekyll gates passed on implementation `40379addae3417751e78966b47fe88c225d16e42`.

## Message-free dashboard bundle and on-demand contact history

- The initial client dashboard bundle now returns the complete contact/conversation directory as message-free summaries with message counts and activity timestamps, plus the first bounded Conversations page. Message bodies no longer scale the initial payload.
- Selecting a Conversations thread hydrates only that tenant thread. Opening a contact with message history hydrates only conversations whose normalized phone/name key matches that contact, then merges the results into the existing directory without dropping calls, leads or unrelated contacts.
- Contact history requests retain the unified-inbox entitlement check and derive the storage key from the authenticated workspace. Phone formatting and fallback names normalize consistently on both server and client.
- Background refresh clears hydration markers with the refreshed summaries; duplicate contact requests are suppressed, failures show a retry state, and demo data remains local.
- Added executable contact-key, tenant-route, message-free bundle, on-demand merge and duplicate-hydration regressions. Local verification: 221 tests passed; syntax and diff checks passed.
- At this checkpoint server reads still scanned the legacy tenant conversation array. The reversible normalized-storage implementation recorded below resolves that backend boundary for migrated workspaces.
- Preview run `36119757372` on an intermediate drawer checkpoint reached the on-demand contact flow with zero page/console/API errors, then failed because the browser test clicked an earlier-message control while the contact hydration repaint was still replacing that element. The drawer now exposes `aria-busy` during hydration and Preview QA waits for the settled state before interacting. Full corrected Preview QA `36120426827` passed.

## Reversible normalized conversation storage

- Added a version 2 message-free conversation index and per-thread detail records. Ordinary list/filter pages no longer read every message body after migration; full-history text search reads normalized details in bounded batches without duplicating message content into the index.
- Reads remain backward compatible: an absent version 2 index uses the untouched legacy tenant array; an unexpectedly missing indexed detail falls back to the matching legacy record. Malformed indexes fail closed.
- Publication validates unique IDs, writes detail records in bounded batches, publishes the index last, and removes obsolete version 2 details only after the replacement index is readable. A failed detail write cannot replace the active index.
- The isolated Preview seed now retains the legacy array and also publishes version 2, exercising the new path without changing production. No production migration route or dashboard action was added.
- Workspace export reconstructs complete normalized histories, while permanent purge and Preview stale-fixture cleanup remove version 2 indexes/details as well as legacy storage.
- The migration and rollback contract is documented in `docs/CONVERSATION_STORAGE_MIGRATION.md`. Implementation `2b531b85b719f6637a4386d9b457aa9a4d1a6b3e`: 236 local tests and the full build passed; CallerCore CI `36132502834` and `36132496608`, CodeQL `36132502896` and `36132496557`, Jekyll `36132502867`, and authenticated Preview Browser QA `36132496626` passed. Preview `dpl_GQFtvtQAFTATSdMSeBd6XmwXq6JM` is READY at https://my-ai-website-on9kecnnk-mohamtaj004bas-projects.vercel.app. Production remained unchanged.

## Shared modal and drawer accessibility consistency

- Client and admin dashboard modals share one accessibility layer that applies named `dialog` semantics, `aria-modal`, and a programmatic fallback focus target without duplicating attributes across every template.
- Opening a modal moves focus inside when the opener did not already choose a field. Tab and Shift+Tab wrap within the active modal, Escape uses the modal's guarded close control, and closing restores focus to a still-connected and visible trigger.
- Implementation `0c440ad13ce3c9b2634f48285b6f78f3b4d793e9`: 239 local tests and the full build passed; CallerCore CI `36132976173` and `36132969862`, CodeQL `36132976255` and `36132969880`, Jekyll `36132976182`, and authenticated Preview Browser QA `36132969888` passed. Preview `dpl_8ouuFQHtquYY4PMCu12eb6t45Cu3` is READY at https://my-ai-website-nah039xzd-mohamtaj004bas-projects.vercel.app. Production remained unchanged.
- Follow-up extends the same focus and keyboard contract to blocking client/admin detail drawers without bypassing pending-save dismissal guards. Authenticated Preview QA now also checks the real admin client drawer semantics; the existing phone-editor checks cover focus wrapping and trigger restoration at laptop, tablet and mobile widths.
- Follow-up implementation `ccc01acc1efaaf6771d5065b1489bbcb21b8d922` passed both CI runs, both CodeQL runs and Jekyll; Preview `dpl_3c6TR172nTmvAQKz9etB9LgJqZsy` is READY. Authenticated QA `36133372442` completed every client/admin interaction and responsive capture, then failed strict diagnostics on one 401 from a client conversation-detail request that remained in flight while the disposable session intentionally rotated to admin. The browser report showed no page errors and no other API errors. The harness correction was fully verified with the next implementation below.

## Client call drawer request consistency

- Rapid call selections now use a monotonic request generation, so a slower earlier call-detail response cannot replace the newer drawer selection or merge stale detail into client state.
- Closing the call drawer invalidates an in-flight detail request. A late response cannot reopen or repaint the closed drawer.
- Added behavioral regressions for out-of-order call-detail responses and close-during-load cancellation. Implementation `6041ad6bfb7d65e696ab634e70687fcb1cd56574`: 241 local tests and the full build passed; CallerCore CI `36134525911` and `36134519423`, CodeQL `36134525818` and `36134519409`, Jekyll `36134525986`, and authenticated Preview Browser QA `36134519432` passed. Preview `dpl_3xayUqsKYaEnT8xL39DVnkKnovWA` is READY at https://my-ai-website-b1ta1ilir-mohamtaj004bas-projects.vercel.app. Production remained unchanged.

## Admin inbox request consistency

- Website-conversation selections now use a monotonic request generation, so a slower earlier response cannot replace a newer website or Gmail thread selection.
- Stale website failures are discarded with their response instead of surfacing an alert after the operator has moved to another thread.
- Added behavioral regressions for out-of-order website responses and website-to-Gmail selection changes. Implementation `21536c28cf7bc583fbda3a2be723d001d0a743ae`: 243 local tests and the full build passed; CallerCore CI `36134842059` and `36134836922`, CodeQL `36134842079` and `36134836806`, and Jekyll `36134842168` passed. Preview `dpl_6WeoMgDpHXw31D9wVVBTbLmNWRmt` is READY. Its browser run was superseded by the next head, whose successful authenticated workflow includes this implementation.

## Admin website analytics request consistency

- Date-range loads now use a monotonic request generation, so a slower response for an earlier range cannot repaint metrics, charts or Growth context after the operator selects a newer range.
- Added an executable out-of-order range regression. Implementation `20918152371ed68c3cd4fd7cc6ffb7b95a0767d2`: 244 local tests and the full build passed; CallerCore CI `36135087160` and `36135080963`, CodeQL `36135087142` and `36135080910`, Jekyll `36135087409`, and authenticated Preview Browser QA `36135080891` passed. Preview `dpl_4t8RVdTEXF2zT7FSzXUwyS314G19` is READY at https://my-ai-website-7xurk1p7v-mohamtaj004bas-projects.vercel.app. Production/main was rechecked unchanged at `37ef5cfcdccae35952822859f64fe83f0b9f09f0`.

## Admin Client Care mutation consistency

- Feedback and support status selectors now lock per record while a write is pending, preventing overlapping writes from making final state response-order dependent without blocking unrelated records.
- Both flows apply the selected state immediately, reconcile the server response, roll back on failure, and always unlock for retry. Pending selectors expose disabled and busy state.
- Added behavioral regressions for duplicate suppression, successful sequential changes, failed rollback and retry. Implementation `6587792907ae334466b90ac99485d1655231a24b`: 246 local tests and the full build passed; CallerCore CI `36135882139` and `36135875540`, CodeQL `36135882109` and `36135875613`, Jekyll `36135882157`, and authenticated Preview Browser QA `36135875530` passed. Preview `dpl_ovFzBJbs3zuCNtRRdKMSsHfz3r6F` is READY at https://my-ai-website-6glghr2pj-mohamtaj004bas-projects.vercel.app. Production/main was rechecked unchanged at `37ef5cfcdccae35952822859f64fe83f0b9f09f0`.

## Admin client drawer request consistency

- Rapid client selections now use a monotonic request generation, so a slower earlier client response cannot replace the newer selected workspace.
- Closing the drawer invalidates an in-flight open request. Support diagnostics also verify both the request generation and current client before applying a response.
- Drawer open/close now updates `aria-hidden` consistently, Escape closes an open drawer, and pending configuration mutations continue to block dismissal.
- Added behavioral regressions for out-of-order client responses, close-during-load cancellation and accessibility state. Local suite: 223 tests passed; syntax and diff checks passed. Included in successful full Preview QA `36120426827`.

## Stripe environment-mode fail-closed readiness

- System Health now detects unrecognized Stripe key formats, mixed secret/publishable modes, live credentials in Preview and test credentials in Production.
- Preview test credentials also require all four explicit test Price IDs, preventing the live catalog defaults from being paired with a test account.
- Embedded Checkout applies the same validation before rate limiting, lead creation or any Stripe request. Stripe configuration health and Billing Portal also stop before provider calls when the environment mode is invalid. Production test keys and Preview live keys fail closed; matching test Preview and live Production modes remain eligible for their later gates.
- The environment scope matrix now makes these enforced mode requirements explicit. Checkout remains disabled unless the separate `CALLERCORE_CHECKOUT_ENABLED=true` release authorization is present.
- Added executable environment-mode, isolated Preview catalog, checkout, health-check and Billing Portal ordering safeguards. Local suite: 228 tests passed; syntax and diff checks passed. Included in successful full Preview QA `36120426827`. No provider request, charge or production configuration change was made.

## Admin workspace mutation consistency — published and Preview verified

- The admin client drawer now locks Plan, Status, account actions, support/configuration controls and dismissal through a Plan/Status save, shared-data refresh and same-client rehydration. Duplicate submissions and client switches are ignored while the mutation is pending.
- The save captures the selected workspace ID and revision. Failures unlock the drawer without replacing the selected draft; successful responses apply the returned revision before refresh.
- The backend now requires the displayed workspace revision and commits the workspace through one compare-and-set operation. Stale snapshots and concurrent writes return 409; ambiguous storage failures return 503 without reporting success or attempting an unsafe rollback.
- Admin client detail responses expose the revision used by this contract. Added behavioral regressions for atomic writes, stale/conflicting/ambiguous failures, pending locks, duplicate suppression, successful rehydration and failure retry state.
- Original local verification: 250 tests passed; full build, JavaScript syntax and diff checks passed. Recreated as published commit `9a8436277ffab6b518bb448e8b88183955baf9b4` through the connected GitHub app; the combined implementation `452ae304` passed full GitHub CI, CodeQL, Jekyll and authenticated Preview QA (run IDs above). Production remains unchanged.

## Admin company-expense mutation consistency — published and Preview verified

- Expense edits and deletions now carry the displayed record revision and update the shared ledger through one compare-and-set operation. Missing edited records return 404 instead of being silently recreated under a new ID.
- Malformed ledgers, stale revisions, concurrent writers and ambiguous storage failures fail closed without replacing newer financial records. New ledger entries are capped at 500, and returned revisions are monotonic.
- The expense modal locks its controls and dismissal while saving, ignores duplicate submissions, preserves the draft on failure and applies the server-returned record before refreshing. Delete actions lock per expense, suppress duplicates and remove only the confirmed record.
- Added behavioral regressions for atomic edit/delete operations, stale/missing/malformed/conflicting storage, pending modal state, duplicate suppression, failure retry state and delete revision payloads.
- Original local verification: 255 tests passed; full build, JavaScript syntax and diff checks passed. Recreated as published commit `452ae304353f095763b2c19e5ca6b95eb8366fae` through the connected GitHub app after the local push lacked credentials. GitHub CI `36179295573`, CodeQL `36179295594`, Jekyll `36179295624` and authenticated Preview QA `36179292162` succeeded on that exact commit; Vercel Preview `dpl_J6mYGjDDDSQDMD1ZteoWk7CQo9Hz` is READY. This is an internal operating-expense ledger change only; no Stripe request, customer billing action or charge was made. Production remains unchanged.

## Recovery note — 2026-09-25

- Work's local Git push could not authenticate. The two intended batches are already published through the connected GitHub app as `9a8436277ffab6b518bb448e8b88183955baf9b4` (admin workspace) and `452ae304353f095763b2c19e5ca6b95eb8366fae` (admin finance). The original unpublished local SHA abbreviations `894a43a` and `b66e759` are not resolvable as remote commits; do not attempt to push or recreate them again without identifying an actual missing code difference.
- The published feature branch was read back at `452ae304`; its GitHub CI/CodeQL/Jekyll and authenticated Preview QA are successful, and Vercel reports a READY Preview for that exact source SHA. Reconciliation checked published filenames and commit descriptions, not byte-for-byte identity with unavailable local Git objects. No claim of local-object equivalence is made.
- `main` remained `37ef5cfcdccae35952822859f64fe83f0b9f09f0` at recovery inspection. Do not merge into main without explicit release authorization.

## Admin workspace revision and company-expense UX follow-up — verified 2026-09-25

- The two admin mutation batches blocked by the former local Work checkout were already published as `9a8436277f` and `452ae30435`, so their original unpublished local SHA strings require no further reconstruction.
- Opening the company-expense modal no longer clears unrelated phone-configuration field errors or status text. Regression coverage asserts those surfaces remain independent.
- Once the server confirms an expense save/delete, a later finance-view refresh failure is reported as a refresh warning rather than falsely telling the administrator the database mutation failed. Confirmed server-returned data remains in the current view.
- Workspace plan/status saves now assign a monotonically advancing revision even when two writes occur within the same millisecond, preserving stale-edit detection. Successful workspace mutations are distinguished from later admin refresh failures.
- Company-expense names cannot be cleared through a direct API edit by falling back to the old name during validation; empty amounts are rejected by both the form and API rather than silently becoming zero. Explicit zero-dollar expenses remain permitted.
- Eight focused development commits since `b93c949` culminated in implementation `2213219c1c3931f79078a80afa5b0e8d804473fb`. Full GitHub CI: 262 tests passed, 0 failed (runs `36188092609`, `36188087934`). CodeQL `36188092548` / `36188087846`, Jekyll `36188092630`, authenticated Preview Browser QA `36188087857`: success. Vercel Preview `dpl_BXx2oqJwLmSfsJtKguZBzhtVUmPt`: READY.
- The last verification applied to the implementation SHA above. This subsequent documentation-only commit is not itself claimed to have completed browser QA. Main remained `37ef5cfcdccae35952822859f64fe83f0b9f09f0`; production was not released or changed.

## Admin workspace scale and atomic audit — verified 2026-09-25

- The shared admin workspace loader no longer slices the first 250 workspace IDs. It reads records in bounded 40-item concurrent batches; Admin Clients and the Finance/Overview aggregates now use the same complete loader, preventing their counts from disagreeing on account coverage. Malformed indexes and indexes exceeding 2,000 fail closed rather than reporting partial totals. A full pagination/aggregation redesign is still necessary before going beyond 2,000 workspaces; this change does not certify production-scale performance at that size.
- Plan/Status updates now use a single revision-checked Redis script that validates and prepends the audit event before writing the updated workspace and bounded audit history together. A conflicting revision, malformed audit history or unconfirmed storage operation does not produce a successful workspace save. Other administrative mutation paths still need separate transaction audit.
- Added executable boundary/partial-index regressions and combined audit transaction/error regressions. Initial new workspace-scale tests exposed two incorrect test assertions; both were corrected after inspecting actual CI failures, without weakening the coverage.
- Implementation `8f535eb4b95e3fc2f63d159b4a73e2d39a51b566`: GitHub CI 266 passed, 0 failed (`36190461861`), CodeQL `36190466395` / `36190461857`, Jekyll `36190466304`, authenticated Preview Browser QA `36190462050`: success. Vercel Preview `dpl_4Mpn1Qk8nBhpB4KwSzYMuVgvSMxL`: READY. No changes were merged into main; no live records, billing or provider activation were touched.
- This subsequent documentation-only commit is not described as receiving the earlier implementation's Preview verification. Continue from actual Git refs, not historical headings.

## Finance history concurrency and operating margin — verified 2026-09-25

- The admin Finance GET previously replaced `finance:history` with a plain `kv.set` on every read, so concurrent refreshes could silently overwrite newly recorded months or replace a newer current-month snapshot. Added `lib/finance-history.js` with a revision-checked compare-and-set, up to three reconciliation attempts, preservation of a later snapshot, sorted/24-month retention, and a fail-closed error when malformed history or unresolved writers prevent a reliable result. The Preview-only initial reconstruction remains available when the original history key is absent; it is not represented as real historical revenue.
- Operating-margin percentage now includes this month's one-time company costs, matching its operational label; net recurring revenue remains separately based on recurring costs only. Added behavioral tests covering lost-update conflicts, newer current-month protection, absent and malformed history, retry exhaustion, Preview seed preservation, and margin calculation with one-time expenses.
- Implementation `b1fcf26dc1e24be9274e29345de7ab473b9c0287`: GitHub CI 273 passed, 0 failed (`36191985064`), CodeQL `36191985579` / `36191977589`, Jekyll `36191985018`, authenticated Preview QA `36191977690` attempt 2: success. Vercel Preview `dpl_7RfNC5ZhBjfHSubrAzgQCf9pnizQ`: READY. The first QA attempt for this SHA was superseded due to workflow scheduling and re-run explicitly to completion. No production merge or deployment, billing, customer data or provider activation occurred.
- This documentation-only follow-up is not claimed to have received the implementation's QA run. Current production/main remained `37ef5cfcdccae35952822859f64fe83f0b9f09f0` when inspected.

## Platform settings transaction and documents scaling — verified 2026-09-25

- Admin Documents previously scanned only the first 300 entries from `workspace:index`, which could omit signed agreements for later customers. It now uses the shared complete, bounded-capacity admin workspace loader and reads each customer's onboarding/lookup records in 20-workspace batches. Added regressions for the 301st agreement, capacity safeguards, and bounded concurrency.
- Platform Settings / launch gate saves previously overwrote the platform record with a plain `kv.set` before appending two separate audit events. Admin saves now submit the last displayed revision, reject stale submissions and competing changes, and commit settings plus one unified audit event atomically with `compareAndAudit`. Audit metadata retains changed gate names and before/after launch states; the separate historical action `platform_launch_gates_update` is now represented within `platform_settings_update` meta rather than emitted as a separate record. Legacy event consumers, if added in future, should account for this.
- Admin Platform Settings now distinguishes confirmed saves from subsequent website/notification refresh failures instead of falsely implying the settings did not save. Regression coverage checks server revision conflict, audit write/failure, changed-gate attribution, monotonic revision and frontend revision submission.
- The initial platform change surfaced an outdated source-string audit test requiring a distinct `platform_launch_gates_update` event; updated it to assert the stronger unified audit transaction contract rather than removing audit coverage. CI has passed since the correction. Browser QA on the final 20-workspace batching implementation also succeeded.
- Implementation `5ed6c4a1620d78effa6f71422ff8e52d1117b5bd`: GitHub CI 280 passed, 0 failed (`36194641261`), CodeQL `36194641278` / `36194635530`, Jekyll `36194641409`, authenticated Preview Browser QA `36194635665`: success. Vercel Preview `dpl_6nxWAhVppdrD5pkw8Xkcc9CCG9pm`: READY. No production deployment, main merge, new charge or provider activation was performed.
- This documentation-only follow-up does not inherit the implementation SHA's test/QA claim. Current main was `37ef5cfcdccae35952822859f64fe83f0b9f09f0` when checked.

## Support status and thread concurrency — verified 2026-09-25

- Admin support status changes previously overwrote the ticket with plain `kv.set` and separately appended audit history, which allowed lost concurrent edits and an unaudited successful status change. The status action now carries the displayed ticket revision, rejects stale requests, advances revision monotonically and commits ticket state plus audit event through one Redis transaction. Unchanged status is a no-op; customer notification is attempted only after a confirmed changed-status commit. Mail delivery is still best-effort and is not an exactly-once outbox guarantee.
- Admin support replies now compare the complete ticket snapshot and append their audit entry atomically. Client replies also compare-and-set the complete ticket snapshot. An intervening status change or reply returns 409, preserving the original thread rather than overwriting it; ambiguous storage errors return 503 and notification emails do not fire before commit. UI currently leaves the user's draft on reply failure and directs them to refresh before resending.
- Admin Support previously only read the first 250 tickets; it now reads up to 2,000 in batches of 40 and fails with a clear error beyond supported capacity rather than silently hiding later tickets. Truly unbounded support history still requires paging/aggregation before that threshold.
- Added behavioral regressions for status auditing, same-millisecond revisions, stale/concurrent requests, no-op status changes, client/admin reply integrity and notifications-after-commit, and 251-ticket directory coverage. Implementation `bcd19c00f21b6e5c97d3d4517ddf0798b1964ea7`: GitHub CI 292 passed, 0 failed (`36195829099`), CodeQL `36195829289` / `36195825310`, Jekyll `36195829150`, authenticated Preview Browser QA `36195825294`: success. Vercel Preview `dpl_6p23ijmqstbBZXhvTvqnHLFw78CB`: READY. Main remained `37ef5cfcdccae35952822859f64fe83f0b9f09f0`; production and live billing were untouched.
- This follow-up documentation commit has not inherited the earlier implementation SHA's exact-commit browser verification.

## Marketing campaign mutation consistency — verified 2026-09-25

- Admin marketing campaigns previously used a record `kv.set` followed by an index `kv.set`; deletion removed the record before editing the index. Concurrent writes could orphan records, lose directory entries, overwrite newer edits, or report partial state as success. Save now atomically compare-and-sets the campaign record plus directory index; deletion compares both snapshots and removes the record plus updates the index within one Redis script. Writes reject absent existing campaigns, stale revisions, index corruption, competing changes and new campaigns beyond 500 supported records.
- The admin campaign list now loads all supported 500 entries in bounded batches rather than silently returning only 250. The editor sends its displayed revision for changes/deletions and locally reflects a confirmed save before any optional campaign-list refresh, so a refresh error does not falsely imply a save failure.
- Added regressions for create/edit/delete atomicity, stale edits, storage errors, index and capacity integrity, list coverage beyond 250, and frontend revision submission. Two test-only issues were corrected after inspecting CI failures: a cross-VM array assertion and an incorrect escaped function delimiter. The earlier erroring Preview belonged to a test-failing SHA; verification applies to the final SHA below.
- Implementation `cacfa94c84ea85843b945913ea318595b78585e4`: GitHub CI 299 tests passed, 0 failed (`36198889956`), CodeQL `36198889970` / `36198886541`, Jekyll `36198889923`, authenticated Preview Browser QA `36198886587`: success. Vercel Preview `dpl_D19cm8m11fJd7wvyNWAkj2ZBhbtG`: READY. Production/main remained `37ef5cfcdccae35952822859f64fe83f0b9f09f0`.
- Campaign mutations still lack a dedicated audit-history event; atomic marketing audit is future scope. This documentation-only follow-up is not claimed to have received the implementation SHA's QA. No main merge, production deployment, billing or provider activation occurred.

## Campaign modal pending-state and draft-preservation follow-up — verified 2026-09-25

- The marketing campaign modal now guards concurrent save/delete actions with a shared pending-action lock. While either mutation is awaiting confirmation, form controls, including modal dismissal, are disabled. Failed saves and deletions preserve the editable draft and display a recoverable inline error rather than closing the editor or silently losing input.
- A confirmed campaign save now applies the server-returned record directly to the current admin view without a redundant post-save campaign-list fetch that could overwrite a newer local action. The modal closes only after the successful mutation, and the lock is released regardless of result.
- Added VM-based frontend regression tests covering duplicate suppression, pending cancellation protection, stale/conflict errors, retryability and success state; updated the previous revision-submission test to expect the guarded delete handler's required campaign object. The first new tests exposed assertion/microtask issues; these were corrected after examining CI without disabling coverage. A previous Preview run failed waiting for a Vercel deployment at a CI-failing intermediate SHA; it is not a verified checkpoint.
- Implementation `576701eeffc7e229482623d79f0f895e34475b49`: GitHub CI 302 passed, 0 failed (`36208725723`), CodeQL `36208725654` / `36208722379`, Jekyll `36208725584`, authenticated Preview Browser QA `36208722320`: success. Vercel Preview `dpl_2kZMXsD5ERKG2j26bvV7x9ar9oMd`: READY. Main was still `37ef5cfcdccae35952822859f64fe83f0b9f09f0`; no production deployment, live record change, billing action or provider activation occurred.
- The present documentation-only follow-up does not inherit implementation-specific browser verification.

## Audited marketing campaign multi-record transactions — verified 2026-09-25

- Campaign create, edit and delete previously committed campaign record/index atomically but did not append a durable audit entry within that same transaction. The reconciled implementation now uses `compareAndAuditBatch` to verify campaign and index snapshots, decode and validate the existing audit history, and then commit campaign/index changes and the bounded audit record together in one Redis script. Deletion removes the campaign key only if the audited transaction succeeds.
- Audit records use scoped admin identity and bounded campaign metadata (id, name, status, budget, updatedAt), without copying potentially sensitive campaign notes into the audit. Actions are `marketing_campaign_create`, `marketing_campaign_update`, `marketing_campaign_delete`. A malformed audit history or conflicting transaction fails closed rather than silently losing the audit or reporting a partial success.
- A concurrently authored second helper was detected before use; the redundant helper was removed, keeping the existing independently tested `compareAndAuditBatch` and all concurrently published campaign changes. Regression coverage verifies the audit payloads and the Lua comparison/encode ordering before any mutation. An intermediate backend SHA had a failed CI test and is not the verification target.
- Implementation `db68806a5eca0b9c3c7d0d635948eb09d09d1056`: GitHub CI 303 passed, 0 failed (`36209111116`), CodeQL `36209111131` / `36209108548`, Jekyll `36209111121`, authenticated Preview Browser QA `36209108644`: success. Vercel Preview `dpl_7rw4jXRSuMNWyDJr9PDSRwfRFNvM`: READY. Main was unchanged at `37ef5cfcdccae35952822859f64fe83f0b9f09f0`; no production merge/deployment or live customer changes were performed.
- This documentation-only follow-up is not described as receiving the earlier implementation's Preview verification. The historic note in the previous marketing section that audits were a future task records the state at that checkpoint; the task is now completed within this coverage.

## Company-document edit/delete consistency — 2026-09-25, verification in progress

- The company-document backend already required `expectedUpdatedAt` for edits and deletions, but the admin editor omitted that field; existing document edits/deletes could fail with 409. The editor now snapshots the displayed record revision and submits it for both operations.
- Save/delete share a pending lock, disable form and close controls during the request, suppress duplicate actions, preserve a failed draft with an inline error, and reconcile confirmed mutations into the existing document list before closing. This eliminates a post-save refresh failure being incorrectly reported as a failed database save.
- Implementation commit `50cef8952c720662a3bd2cd42711033a75f1acc1`; dedicated frontend regression tests added in `aa371c5fa0e5c2152e1e82ba6327025733123b00`. CI and authenticated Preview QA are **not yet verified** for this checkpoint; check exact-head workflows and fix any failure before describing it as verified.
- Next: check CI/Preview, inspect document-link validation and read/list corruption safeguards, then continue remaining admin record consistency review. Main and production were not intentionally changed by these feature-branch commits.
