# CallerCore engineering changes

Read `CALLERCORE_PROJECT_STATE.md` before continuing work. Preserve verified work, historical evidence, financial uncertainty and unrelated changes. Follow [permanent engineering quality standards](docs/ENGINEERING_QUALITY.md) across every product surface and the [organization roadmap](docs/AGENT_ORGANIZATION_ROADMAP.md).

Before substantial implementation, record scope/risk, trust boundaries, failure cases, planned tests and rollback. Use the conservative risk floor from `npm run preflight:engineering -- --working`; changes may raise risk but never downgrade its floor. Commit a change-bound plan in `docs/engineering-changes/` with the actual old/new Git blob digest and required verification labels. After committing, run `npm run preflight:engineering -- --base <verified-before-sha>`. CI checks every new commit from that base. Missing plans/history or dirty local state fails closed.

Agent Operations additionally requires `npm run preflight:agentops`. Do not regenerate its contract lock automatically or weaken stale-state/semantic acceptance to pass a test. Mocks see only actual requests; preserve frozen live-response replays. Significant defects need root cause, detection gap, permanent regression and historical prevention evidence.

Engineering, Independent QA and Engineering Auditor have separate responsibilities. Critical changes need independent QA and security/Auditor review, applicable full regressions, CI/CodeQL and exact-source Preview checks. Plan completeness is not completed verification or authenticated approval. Readiness distinguishes unit/integration/replay/mock/live/Production; never infer live truth from tests.

Paid execution, new autonomous write permissions and Production capabilities remain disabled unless separately authorized. No model or department lead can waive failed mandatory acceptance/security. PR5 stays draft/unmerged. Do not change customer data or send external notifications without authorization.
