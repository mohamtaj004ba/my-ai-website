# Starter Automations fallback correction

The Engineering Specialist generated the product change. Work verified and applied its exact replacement, and is responsible for review, tests and Preview publication. Internal agents received no repository or deployment permission. This delivery does not alter the original Auditor rejection or establish independently authenticated business acceptance.

## Provenance

Original workflow `wf_8cc34f3e04ef8197533aa472398aae53`, source `0abe4fa08446e7bb3b8d0021deb5689d2917d6db`. The preserved five-receipt export has SHA256 `cb561cc4d6c878c1628a4c9486817a7d847ff3b55bbe39ef2b3a44abf8b58f9f`; all five receipt hashes were recomputed. Specialist patch hash `0104c1847df44e56565b58d085ab60a6f0f997efcfa8f1c46c23aaa65f815669`. Before source SHA256 `202a482a439821294d30a984d8f7402b9102fb5d28680a931da31969785ea049`; after `c812f5c62121e503ecd0946f7ca6d09eeac1a1147b4110d7dbc5c50493146cef`. The entire current product file matched the original preimage before application; exactly one replacement produced the expected after hash.

```diff
-    ['automations',d=>{automationsData=d.automations||[]}],
+    ...(has('automations') ? [['automations',d=>{automationsData=d.automations||[]}]] : []),
```

## Problem and impact

`loadSecondaryClientData` constructed an array containing Automations for every plan. Starter explicitly excludes that feature, and the account API independently requires it. A fallback/retry could therefore send an unnecessary denied request and display an incomplete-coverage warning for an intentionally unavailable feature. This is a request/feedback defect, not evidence of customer data loss or an authorization bypass.

The enclosing expression is an array, so the conditional spread is valid. Existing `has` reads authenticated workspace feature metadata, falling back to the configured plan when metadata is absent. Workspace/session initialization precedes the loader. Bundled success returns before secondary loading. Existing Automations rendering also checks entitlement; downgrading cannot expose the feature through this patch. The backend GET and save authorization remain unchanged.

Starter now omits that optional request. Growth/Pro retain the exact handler. Other feeds, generation checks, preserved prior records, critical loading/synchronization, calendar capability checks and retry messages retain their existing behavior. Actual customer occurrence and invoice impact have not been measured. Browser evidence uses fictional page-local entitlements and intercepted responses, not plan changes in a customer account.

## Completed acceptance criteria and verification

| Criterion | Evidence required |
| --- | --- |
| Starter omits the secondary Automations request and its expected-denial warning. | Current-source plan matrix and rendered fictional Starter fallback/retry. |
| Growth and Pro retain the request and unchanged assignment handler. | Current-source exact source diff, payload application and rendered entitlement matrix. |
| Plan transitions respect the latest entitlement. | Upgrade/downgrade source tests and existing rendering gate. |
| Unrelated failures remain visible and recoverable. | Other-feed failure, invalid payload, preserved records and retry tests; rendered warning/retry. |
| Stale responses cannot overwrite current data/coverage. | Existing generation/cancellation regression cases. |
| Critical loading and last-success timestamps stay truthful. | Existing fallback synchronization tests plus rendered bundled/fallback checks. |
| Server authorization and publication boundaries remain intact. | Unchanged account API permission checks, independent source review, no internal-agent writes. |

The original report omitted enclosing context and dynamic evidence, contained incomplete prose, and did not establish all these criteria. Its nested patch mapping actually forbids `evidenceIds`; the historical Auditor criticism demanding that field is not retrospectively treated as valid schema advice. Work's new analysis/tests supplement the original evidence without rewriting or converting its rejection into acceptance.

## Historical compatibility

The fixed Starter implementation task is retired for fresh current-source admission. Readiness returns no usable task hash for it; source/task admission fails before a new assignment journal append. Current generic source tools use a newly pinned evidence-v5 asset and current manifest. All earlier evidence assets and the compressed implementation source-v1 asset remain unchanged.

Historical test files explicitly import a test-only fixture to replay the old task; those tests are not current-source admission proof. The separate current-product suite imports no override and verifies retirement, source hashes, current read tools and denial before writes. The data-only copy verifier can select the exact hash-verified frozen preimage for historical proposals while preserving patch validation, task binding, before/after authorization, current-file integrity, cancellation and disposal. It does not authorize execution, grant access or treat historical source as the current application.

Final release identity, test counts, independent reviews and actual Browser archive verification are recorded in `CALLERCORE_PROJECT_STATE.md`. No new model calls are needed for this delivery. Production/main remain unchanged and PR #5 remains draft/unmerged.
