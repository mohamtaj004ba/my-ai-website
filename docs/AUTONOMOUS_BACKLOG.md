# Current actionable engineering backlog

Updated: 2026-10-06. Applies only to `feature/callercore-dashboards` and Preview. September roadmaps describe historical or post-launch work; they are not a list of current launch failures.

## Completed or ready for current verification

| Item | Current implementation/evidence | Remaining limit |
| --- | --- | --- |
| Native billing and Stripe sandbox | `STRIPE_SANDBOX_ACCEPTANCE.md`; actual card payments, recovery, lifecycle and isolation passed | Production sales still closed; no repeat of accepted billing phase |
| Readiness labels | Sandbox acceptance shown separately from production authorization; current environment failures cannot inherit acceptance | No automatic owner launch confirmation |
| Voice configuration, secure tools, lifecycle, CRM and usage | Provider-backed isolated internal/demo infrastructure and tests in `VOICE_PREVIEW_RUNBOOK.md` | Latest acoustic/transfer acceptance is deferred |
| Delayed results recovery | Fair persistent cursor, deduplication, bounded event recovery and authenticated maintenance endpoint | Recurring worker installation needs its own authorized secret destination |
| Maintenance runner | `scripts/voice-maintenance-runner.mjs`: exact branch URL, timeout, no redirects/retries, safe validated counters | Runner is not an installed schedule |
| Recovery/export coverage | Canonical voice calls, configuration, journals, contacts, pending details, usage and follow-ups; source/concurrency validation | No managed database restore or automatic provider activation |
| Export experience | On-page client/admin/test downloads; failed or stale requests deliver no file | Host/device download behavior still needs browser verification |
| Voice retention inventory | Administrator-only read-only counts, content/metadata age separation, invalid-date reporting, no content or provider IDs returned | Holds/provider deletion review and destructive execution remain gated |
| Permanent deletion safety | Voice-bearing workspaces fail closed before new/resumed purge | Full voice cleanup is not implemented or silently enabled |
| Monthly analytics and retention dry-run | `monthly-kpi-*`, `analytics-retention-policy`, `retention-report` and their tests already exist | Destructive prospect/session executors stay off pending consent/recovery review |
| Admin global search | Existing accessible search and client/support/prospect/call navigation; behavioral coverage in `admin-global-*` tests | Do not describe it as a newly missing feature |
| SDK migration | `lib/kv.js` uses supported `@upstash/redis` with strict isolated Preview credentials | Runtime dependency deprecation warnings remain separate diagnostics |
| Responsive public/client/admin/voice UX | Authenticated multi-size browser QA, including voice states and retention report | Emulation is not physical-device evidence |

## Work requiring owner action, approval or deferred participation

| Item | Smallest next action | Prepared work |
| --- | --- | --- |
| Recurring maintenance | Approve a scheduler and storing the existing restricted Preview callback secret there; its present authorization covers Vercel Preview only | Tested runner and endpoint; no Production cron or new credential |
| Managed backups | Approve desired backup retention and enable Daily Backup on the isolated Preview database | Read-only account inspection and exact restore checklist in `BACKUP_AND_RECOVERY.md` |
| Database restore rehearsal | Approve a separate disposable database/restore target and the provider's destructive restore step | Export/state recovery tests; no restore over active Preview/Production |
| Provider-aware deletion | Confirm voice/transcription retention and holds; authorize provider deletion only against disposable resources | Inventory, export validation and purge guard; no deletion endpoint |
| Phone conversation quality, ending and human/no-answer transfer | Resume the telephone retests deferred by TJ, with a controlled transfer receiver | Actual scenarios and evidence matrix in voice runbook |
| Demo abuse and public exposure | Complete number-level acceptance within remaining approved spending and disclosure limits | Isolated core, duration/rate controls, readiness guard and unavailable fallback |
| Complete customer activation journey | Explicitly authorize customer telephony and final launch gates | Billing and voice subsystems separately tested; a stored config is not live activation |
| Legal, entity/tax, pricing/fair use, recordings, customer telephony, live checkout | Owner/professional decisions and explicit release authorization | Technical readiness cannot authorize these |
| Real phone/tablet browser checks | Access to the physical devices | Multi-size automated browser evidence |

## Conditional post-launch product roadmap

The September roadmap explicitly places these after core launch or behind a provider/product decision: broad account/dashboard modularization, relational datastore migration, multi-user workspace roles, canonical cross-channel contacts, Gmail push/history synchronization, notification delivery channels, calendar booking, SMS and marketing campaigns. Core launch remains gated. They are not represented as completed, and implementing/enabling third-party delivery or expanding customer scopes is not inferred from Preview maintenance authorization. Existing contacts/history, notification categories, search, campaign analytics and consent/suppression safeguards remain preserved.

Verification for the new items above is recorded in `CURRENT_DELIVERY_STATUS.md` and `CALLERCORE_PROJECT_STATE.md`, with exact runtime SHA and workflow runs. Do not equate local fixtures with actual phone, legal, backup or Production acceptance.
