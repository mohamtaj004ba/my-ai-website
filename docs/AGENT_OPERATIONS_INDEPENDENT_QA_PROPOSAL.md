# Independent QA of the accepted delegation milestone

Preparation only. Paid execution remains disabled. No QA task, reservation, provider request, activation or deployment is authorized by this document. The prior delegation pilot is accepted as a technical milestone; its original visual findings are not automatically accepted.

## Immutable evidence and exact assignment

Review only task `cb886190-18e5-4edb-8699-4ab070bbaabf`, specialist execution `exec_e0eddfb2644e48eca3a52311e32e3faa`, pinned inspection source `8133597ff2fc5b48e3de42336e9e06fa4191c2a8`. Use its four ORIGINAL PNG files, ordered Legal1440, Legal390, pricing1440, pricing390, and the exact original `results.inspect` (including all four finding codes and notes). Do not recapture pages, browse, edit screenshots, initiate Chief/specialist calls or resume the terminal source task.

- Source inspection-result hash (existing `hash` function over complete original result): `11aa51913861bc4e57a28adb2d772456736b6e44d40bb751bf29c1fe0d479540`.
- Ordered artifact aggregate: `08870d2218527ef0fcccf7f3961054481e434a6d1df1bf6ab3f89183003a4e40`.
- Original saved report SHA256: `d97ab615ef705f85074308eee41fccbd017fefbea339640596bbaae20dc325e5`. This is a local evidence-envelope hash, not a replacement for comparing the hosted durable task/result/reservations.
- Exact filenames, individual hashes, dimensions and capture times are in the canonical handoff and `artifacts/agent-operations/independent-qa-evidence-probe.json`. Hash and PNG-header validation passed for all four existing files. No original file or record was rewritten.

The independent reviewer must compare each claim against image evidence, distinguish direct observation from inference, identify any unsupported part and decide accept/reject AS WRITTEN. A partly true finding with an incorrect location or unsupported conclusion must be rejected with a specific reason; its supported observation can be stated separately. Evidence insufficiency produces reject/insufficient-evidence, never guessed acceptance. No external business/legal facts or release authority are granted.

## Image capability and required request

Selected model remains `gpt-4.1-2025-04-14` in CallerCore Agent Operations project `proj_yXcOqJDtCRl2chdkRYAJ6VvH`, organization `org-0Q2ER0RtAeROLY3fYSuMn5CX`. Official model documentation supports image input and Responses. PNG data URLs and `detail=high` are supported; high detail is proposed for small dashboard/heading text, not a new screenshot or extra request. It cannot recover information absent from the original PNG.

Offline verification14:19:44.704-07:00 ran the ACTUAL current `pilotAdapter` review request builder with the persisted PNGs supplied by a local capture stub and a mock provider. Global networking was forbidden, credentials were a dummy string. It verified four `input_image` data URLs decoded to the exact original SHA256 values, unmodified prior findings, the pinned model, native `/v1/responses`, no tools and `store=false`. One mocked call, ZERO live calls. Source report hash stayed unchanged. This proves request inclusion/format, not model comprehension or live QA quality.

Current production code hardcodes `detail=low`; high detail is NOT implemented. Current review also recaptures evidence inside a normal four-stage task and returns only an overall boolean. Its two-stage profile explicitly rejects review. Do not reuse normal approval, reopen the completed task, manipulate its stage or merely stop a broader worker after one call.

The proposed QA-only serializer must attach exactly the four original bytes as `input_image` with `detail=high`, labeled by original filename/hash/viewport. Use one fresh independent context: fixed developer QA instructions and untrusted original findings/manifest/images. Do not provide the owner's correction, previous narrative assessment, golden answers or a simulated verdict as evidence. No continuation of specialist conversation and no tools. Keep existing native request/authentication, diagnostics and token-cost validation. Input text <=10000bytes, each existing PNG data URL <=3000000characters, four exact images only, 1500 output tokens maximum.

Required offline contract gates on that final actual path: missing/extra/substituted/unreadable files, hash or aggregate mismatch, altered source findings, wrong model/detail/count and text-only requests all fail before dispatch. Assert all four decoded outbound images still hash to the approved originals. Mocked success/failure fixtures must not be described as real QA judgments.

Official references checked October11: [GPT-4.1 model, modalities and pricing](https://developers.openai.com/api/docs/models/gpt-4.1), [image inputs and detail levels](https://developers.openai.com/api/docs/guides/images-vision).

## Separate verdict contract and storage

Create a NEW Preview-only `evidence-qa` task, bound by trusted owner approval to source task ID, source specialist execution ID, original-result hash, exact four artifact hashes/aggregate, project/model, one call and $0.30 ceiling. Source identity comes from broker-verified durable state, not worker/model authority. The trusted parent reads only the four allowlisted artifact files; the restricted worker receives those bytes through task-bound IPC. No broad file access or Vercel/broker credentials reach it.

Store an immutable source-reference/snapshot and a separate `qaVerdict` on the new task. Do not write `results.review` on the source task or change its status, findings, usage, reservations or audit history. Record creation, source validation, claim/fence, reservation, provider evidence and terminal verdict on the QA task, including its own execution ID, request/response IDs, model, token usage, cost and diagnostics. Historical tasks and the source report/files remain byte/deep-equal before/after.

Bounded JSON output:

```json
{
  "stage": "review",
  "decision": "reject",
  "findings": [
    {
      "code": "<one exact original finding code>",
      "decision": "accept or reject",
      "evidenceSufficient": true,
      "reason": "<specific reason, max 1000 characters>",
      "observed": "<direct visual observation, max 1000 characters>",
      "unsupportedClaims": ["<max 4 entries, each max 500 characters>"],
      "evidence": [{"path": "<original allowlisted filename>", "sha256": "<matching original hash>", "region": "<plain visual location, max 200 characters>"}]
    }
  ],
  "note": "<max 1000 characters>"
}
```

Exactly four unique per-finding verdicts covering the original codes; no omitted/added findings. Decisions are enums, booleans strict, evidence references constrained to approved files/hashes, at least one evidence reference and nonempty reason per verdict. Unreadable content must be explained. Reject unknown authority/tool fields. Overall acceptance requires every finding accepted with sufficient evidence; otherwise overall reject. Broker independently validates the contract and binds trusted source hashes rather than accepting model-supplied identity. A valid reject verdict is successful QA execution, not a worker failure. Invalid output preserves diagnostics/usage conservatively and stops without retry.

## Proposed spending, timing and permissions

One attempted model request total; no retries, recurrence, delegation, report stage or automatic repair. 1500 output tokens; 90second execution deadline; task and one-use approval <=10minutes. Commit one $0.30 reservation before provider dispatch, after evidence validation. Preserve cancellation, lease/fencing, no paid replay, fail-closed durable storage and existing diagnostic sanitization. Uncertain attempts retain the hold; no invoice certainty or zero-cost inference from missing usage.

Estimated token-derived cost $0.015–$0.04 for the four high-detail images and bounded verdict. Illustrative 6000 aggregate input tokens INCLUDING images plus1000 output=$0.020 at $2/M input/$8/M output, no cache discount assumed. Image token usage is an estimate, verified usage governs settlement. Hard new allowance is $0.30, independent of the estimate and project budget alerts. Existing conservative ceilings$1.50 + proposed$0.30 =$1.80 within unchanged$5 cumulative/day/month enforcement. Retain historical$0.60 uncertain holds and all settled smoke/delegation ceilings/receipts. Prior known settled usage$0.006178 remains separate from conservative allowance and historical unknown charges.

No website/browser/external action or fresh capture. Protected Preview broker uses the existing parent-held short-lived identity; no protection or permission expansion. Dedicated API credential only, no Default/Preview key changes. No Production/customer-data/repository mutation during a future live run. Internal QA ledger, diagnostic and verdict artifact writes only.

After verified implementation and SEPARATE explicit live authorization, rehearse exact-source disabled Preview redeployment, verify source evidence/old ledger/credentials, then activate only task-bound one-use QA approval. On success/failure consume approval, restore paid=false, remove approval, redeploy the same source disabled and authenticate paid=false on BOTH activated/replacement brokers. Do not activate without verified rollback or evidence inclusion. No subsequent task follows automatically.

## Acceptance and readiness

1. Offline final request includes four byte/hash-exact ORIGINAL image inputs at high detail; no text-only fallback. Live response must cite specific visible regions and explicitly distinguish evidence from inference. Capability does not prove correctness.
2. Exactly one independent QA invocation, exactly four separately reasoned decisions, durable separate verdict/source linkage and no source record/file change. No recapture, specialist rerun, report, retry or automatic correction.
3. Evaluation must detect unsupported Legal-specific/confidential-record conclusions and distinguish the Growth heading/badge overlap from a claim that the price is obscured. These are evaluator acceptance checks, NOT hints to inject into model input. If it repeats unsupported claims, record quality failure honestly; no extra call to repair its answer.
4. Actual usage, settled cost or uncertainty and prior accounting are verifiable; new exposure <=$0.30, conservative total <=$1.80, unchanged $5 enforcement. Verify credential isolation, durable audit and cancellation/lease/no-replay regressions.
5. Both brokers disabled after cleanup; PR5 stays draft/unmerged and Production unchanged.

**Prepared proposal, not executable readiness.** Image-input capability is established for GPT-4.1 and the existing low-detail serializer. Minimal QA-only profile/admission/reservation/worker guards, immutable source binding, original-artifact IPC, high-detail request construction, per-finding validation and separate verdict persistence still require implementation plus targeted/full/independent security/hosted Preview verification while paid=false. This preparation makes no application code or deployment changes and does not request paid approval prematurely. Do not execute until those gates and a separate explicit QA pilot authorization are complete.
