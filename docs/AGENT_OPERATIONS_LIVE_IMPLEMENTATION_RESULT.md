# First genuine agent-generated implementation workflow

## Verified result

All five stages completed using genuine `gpt-6.1-sol` Medium reasoning in one serial run. The Engineering Specialist generated a source-bound patch for the Starter-plan Automations feed. The trusted backend validated the patch, applied it only to a disposable source copy, preserved the application evidence and destroyed that copy.

**The workflow completed. The proposal was not accepted or published.** The Engineering Auditor rejected incomplete reporting, and the final Chief preserved that rejection.

| Stage | Actual result |
| --- | --- |
| Chief assignment | Source-backed delegation with entitlement, unchanged-handler and verification-limit criteria |
| Engineering Specialist | Actual model-generated single-line patch, validated preimage and isolated application |
| Automated QA | Accepted the source observation only; criticized incomplete verification/reporting |
| Engineering Auditor | Rejected the report as incomplete; did not establish that the proposed gate was wrong |
| Final Chief | Preserved QA decisions and Auditor rejection; did not claim acceptance |

## Exact original run

- Source: `0abe4fa08446e7bb3b8d0021deb5689d2917d6db`.
- Fingerprint: `a482e26bcf58b1bd2cf2a7df57465928f6ab64fc3438161cf0885dc61444fd15`.
- Preview: `dpl_2i7aXxZKhdVwzVJkCD97WXATVfTf`.
- Task: `op_0b93f028858b4db58152b90e5344752a`.
- Workflow: `wf_8cc34f3e04ef8197533aa472398aae53`.
- One-time approval: `pilot_8cc34f3e04ef8197533aa472398aae53`; consumed and revoked.
- Model-stage interval: 371,406 ms, approximately 6 minutes 11 seconds.
- Five Responses calls and five counting calls; no retries.

## Agent-authored patch

The Specialist proposed conditionally including the existing Automations feed when `has('automations')` is true, preserving its original handler:

```diff
-    ['automations',d=>{automationsData=d.automations||[]}],
+    ...(has('automations') ? [['automations',d=>{automationsData=d.automations||[]}]] : []),
```

Patch hash: `0104c1847df44e56565b58d085ab60a6f0f997efcfa8f1c46c23aaa65f815669`.

Independent static verification reproduced the worker's before/after hashes against the exact Git blob, with one unique replacement. Source size changed from 615,443 to 615,476 bytes in the disposable copy. The original `dashboard.js` remained unchanged. Work additionally performed a parse-only JavaScript syntax check on the exact hash-verified patched bytes; it passed, and that temporary verifier copy was destroyed. This did not execute the generated source or run dynamic tests. No generated code or tests executed; dynamic behavior and customer impact remain unverified.

## Evidence and accounting

The complete five sanitized model receipts were exported losslessly from the authenticated result. The 24,952-byte archive JSON has SHA-256 `cb561cc4d6c878c1628a4c9486817a7d847ff3b55bbe39ef2b3a44abf8b58f9f`; originals remain immutable in the backend. Work QA and Engineering Auditor independently recomputed all five receipt hashes and validated source/workspace bindings. Their automated technical review is not independent human acceptance.

| Usage | Total |
| --- | ---: |
| Input tokens | 13,864 |
| Output tokens | 3,400 |
| Reasoning tokens, included in output accounting | 648 |
| Calculated Responses cost | $0.061728 |

Counting fees, provider adjustments and invoice matching remain unresolved. Internal retained estimates are not provider invoices. The owner-directed billing-monitoring policy preserves historical amounts without using obsolete financial or lifetime-attempt caps as admission barriers.

## Reporting findings and correction

Several completed model strings ended at their 180/600-character schema ceilings. This demonstrates incomplete prose, not backend clipping or output-token exhaustion. A separate instruction ambiguity confused top-level acceptance mappings with nested patch mappings: the latter forbid `evidenceIds`. The original Auditor rejection remains historical even though that specific criticism demanded a schema-forbidden field.

Later requests already contained trusted backend application and cleanup evidence. The final Chief should distinguish the model's earlier inert proposal from the subsequent backend copy operation; an earlier model statement cannot negate later verified worker evidence.

Work clarified the existing role-specific instructions and preserved precise QA evidence restrictions, complete criticism, verbatim review outcomes and all server-side authorization controls. This was Work-authored infrastructure guidance, not an agent-authored product fix. Future model quality on the corrected instructions remains unproven until a separately admitted run; no paid repeat is necessary merely to reprove this milestone.

## Observed latency

Of the 371.406-second model-stage workflow interval, 154.155 seconds occurred before Responses dispatch and 34.083 seconds between stages. Those intervals include authorization, token counting and persistence. The remaining 183.168 seconds includes provider requests, validation, disposable-copy processing and storage; it is not a measurement of pure model time. Future efficiency work should remove demonstrated redundant round trips rather than weakening authorization or inventing a model-performance diagnosis.

## Shutdown and next capability

Actual readback verified paid execution disabled, approval revoked, zero leases/active grants/active attempts, full cleanup and cancellation of the frozen admission manifest. Production and main remain unchanged; PR #5 remains draft and unmerged.

The next capability is independently qualified OS-isolated execution of approved tests against an agent patch. The existing Node worker is a trusted data-copy mechanism, not an untrusted-code sandbox. The managed code-only VM candidate and custom dedicated browser have different qualification requirements. No new sandbox/browser infrastructure was purchased, built or launched.

The dedicated browser still requires a qualified builder, complete build/import/storage/transfer cost treatment and a CallerCore-owned protected Preview identity. The current pinned C.6 image manifest is the reference; older C.5 failure records remain historical.
