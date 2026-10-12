# Sol comparison image-budget review — October 11, 2026

Status: offline arithmetic and reservation controls verified; **live image-budget prerequisite NOT passed**. No model request, activation, ledger write, key change or application change. Do not set `CALLERCORE_AGENTOPS_SOL_VISION_BOUND_VERIFIED` from this estimate.

## Conservative estimate

The official [vision guide](https://developers.openai.com/api/docs/guides/images-vision) specifies 32-pixel patch and 512-pixel tile methods, but omits `gpt-6.1-sol` from its sizing/multiplier tables. Rather than infer that Sol shares Astra's formula, the offline calculation uses the larger of every published high-detail method for the original dimensions. For tiles it deliberately omits downscaling; the largest published base/tile rates are 2,833/5,667. For patches it uses the largest listed multiplier, 2.46, plus one rounding token. This is a conservative envelope across documented methods, **not a provider guarantee about an undocumented Sol encoder**.

| Original PNGs | Dimensions | Patches/image | Tile envelope/image | Pair envelope |
| --- | --- | --- | --- | --- |
| Legal and pricing desktop | 1440 × 1000 | 1,440 | 36,835 | 73,670 |
| Legal and pricing mobile | 390 × 1000 | 416 | 14,167 | 28,334 |

All four original file hashes and PNG dimensions were verified offline. Image envelope: **102,004 tokens per request**. Add a conservative 40,000-token allowance for the entire serialized non-image request (instructions, messages, observation, claims, strict schema, metadata and protocol headroom). The existing planning gate admits at most 40,000 serialized UTF-8 bytes after removing image entries; the byte heuristic itself is not an exact provider token count. Combined planning envelope: **142,004 input tokens**.

The official [Sol model page](https://developers.openai.com/api/docs/models/gpt-6.1-sol) publishes standard Global rates of $2/M input and $10/M output. The calculation assumes explicit no-cache/no-breakpoints, no regional/Fast/Ultrafast uplift, no tools, and input below the 272K long-context threshold. All generated tokens, including reasoning, count toward `max_output_tokens`; see [token counting](https://developers.openai.com/api/docs/guides/token-counting).

| Configuration | Cost/request at planning envelope | Two requests |
| --- | --- | --- |
| Current 25,000 output tokens | $0.534008 | **$1.068016 — exceeds $1** |
| Recommended 20,000 output tokens | $0.484008 | **$0.968016 — within estimated $1** |

Recommended adjustment, not implemented/activated: retain all original high-detail PNGs, Medium reasoning, and the same evidence-first comparison; cap total output at 20,000 per stage and require a verified pre-dispatch input count of at most 145,000. At those limits cost is $0.49/request, with $0.50 reserved/request, $1/task. The output cap includes reasoning and visible JSON together. Lowering it may affect completion; failure remains incomplete/unaccepted with no retry. Do not reduce detail or remove screenshots to manufacture a cheaper but weaker comparison.

The current 120,000-input/25,000-output profile and 20,000-tokens/image heuristic are unchanged. Its $0.49 formula only bounds actual cost **if** the actual input is already known to satisfy 120,000. The post-response usage guard cannot enforce an unknown input bound before charging. A $0.50 reservation is CallerCore admission/accounting, not an OpenAI per-request hard stop.

## Accounting and verification

Retained conservative allowance remains $2.40, including $0.90 pending uncertainty ($0.60 historical plus $0.30 incomplete evidence-first request). Known token-derived settled usage $0.037254 is separate, not invoice reconciliation and not added again to reservation ceilings. Two proposed $0.50 reservations would raise retained allowance to $3.40 within $5. No reservation was created or released. Atomic broker checks sum retained ceilings across pending and settled records, before dispatch; cancellation/lease failure cannot retry a paid request.

Offline helper `../../agentops-tools/sol-image-budget-offline.cjs` produced ignored `artifacts/agent-operations/sol-image-budget-offline.json` at 2026-10-12 00:45:04.843 UTC. It reads only original evidence, asserts hashes/dimensions/arithmetic, and has no network/credential/ledger path. Targeted actual request/security tests: **15/15 pass**. No full-suite rerun claimed for this documentation/offline-analysis-only change.

Protected exact e10d359 Preview readback 00:45:36.222 UTC: paidExecution=false, approval absent, candidate disabled, access/vision activation flags false; all six historical tasks/reservations and four original hashes unchanged. Six paid initialization attempts denied403, foreign task403, wrong credential401, missing Preview identity302; durable state unchanged. PR5 freshly read open/draft/unmerged at e10d359. Latest Production metadata remains READY `dpl_4d13ERbPnK5gW4cBJjFMDUHNW1wY`, source6d36aa454241588140a3d9945eed1a5696a65db6; no Production application access or changes.

## Remaining gate and conditional proposal

The official token-counting endpoint can return exact image/payload input counts, but the opened guide does not establish a zero-charge contract. It was not called under non-billable-only authorization. A documented Sol-specific image upper bound, or confirmed non-billable same-body counting before each inference, is still required. Counts must bind model, detail, image hashes, instructions and strict schema, including the newly sealed Stage1 observations in Stage2. Any payload change, missing count, unsupported parameter, uncertain pricing or count exceeding the limit must deny dispatch. Do not simply mark the current heuristic verified.

Conditional comparison: one task, at most two Sol/Medium calls (blind observation durably sealed, then fresh-context adjudication), all four original images and 15 visual cases/22 atoms plus deterministic C16; 20,000 output tokens/call, 180 seconds/stage, ten minutes/task; no retry/recurrence/capture/browsing/tools/customer/Production actions. Two $0.50 reservations; existing uncertainty untouched. Deterministic geometry remains reproduction-only. Acceptance requires complete outputs, image integrity, zero false approvals/9, zero false rejections/6, all five insufficient cases handled correctly, accurate heading-versus-price localization, and separate independent image/reason/region review. Structural completion never implies substantive acceptance. Cleanup must remove approval and verify paidExecution=false on activated and replacement brokers.

**Do not request paid execution approval yet:** the adjusted arithmetic is feasible, but the unknown Sol input bound prevents a guaranteed $1 charge ceiling. This is one specific documentation/counting-contract blocker, not a model-access or credit blocker. No repeated model probes or additional development workarounds are warranted until it is resolved.
