# Call-row proposal: adoption review and runtime-test candidate

This is a Work-authored review addendum. It does not replace the model reports,
resolve their immutable quality observations, change the Auditor's rejection,
grant acceptance, or apply the patch to the product.

## Preserved proposal and observed report defects

- Original live workflow: `wf_d05c65b089bad6db24f9811b2c0f4426`.
- Agent patch: `8f4f614467e665a277cb2a5a6e43a25b0bc6aa21693e1f5e111be68f7fbe501c`.
- Baseline `dashboard.js`: `a79132d86e64401a08623ceed9cdbcd31371386a8bb0774f29d7004eb6ba47df`.
- Patched disposable copy: `8defc782ad52401e14df1d3e05e28286a341a844f31688ec51c082a9ccd61814`.
- Original source release: `871d418dbcd013ad3d37845265e733e4d561c505`.

The Chief scope contains malformed wording below its length ceiling. Five other
flagged narrative fields reached their schema ceilings: Specialist uncertainty
200 characters, two verification statements 180 each, QA uncertainty 400, and
one Auditor risk 300. These are directly observed text/length facts. They do not
establish why the provider generated those strings or prove a decoder defect.

For future assignments, author one short complete statement per narrative field,
aim below half its ceiling, and keep hashes and source identity in their typed
fields. Never fix an incomplete sentence by appending punctuation. Final Chief
must still copy QA findings exactly and preserve Auditor references and rejection;
brevity guidance must not rewrite a critic's existing evidence.

## Complete wording for a future revised report

These are reviewer-authored suggestions, not a new agent run:

| Field needing revision | Complete replacement suggestion |
| --- | --- |
| Chief scope | Change only the call-row accessible label. |
| Specialist uncertainty | Runtime and assistive-technology behavior remain unverified. |
| Specialist verification strategy | Compare the full diff and verify all non-label text is unchanged. |
| Proposal verification | Check valid, equal, missing and invalid timestamps. |
| QA uncertainty | Static review does not establish runtime behavior or uniqueness. |
| Auditor final risk | Independent runtime and accessibility checks remain outstanding. |

Avoid absolute claims that no files were written: the guarded worker did write
a disposable copy. The accurate distinction is that the real repository/product
was unchanged and generated source was not executed.

## Acceptance and impact mapping

The source supports a caller-only accessible-name omission. Adding time may help
users distinguish calls with different resolved timestamps. Customer benefit,
screen-reader usability and uniqueness for every record remain unverified.

1. Reproduce equal baseline labels for the same caller at different valid times.
2. Verify the proposed row produces different labels for those valid times.
3. Preserve escaping for caller text and the fallback time; do not inject HTML
   or extra attributes.
4. Preserve unknown-caller and missing-time fallbacks.
5. Explicitly retain the equal-timestamp uniqueness limitation.
6. Require graceful invalid/out-of-range timestamp handling. The current source
   admits truthy numeric timestamps without checking Date range. This is a test
   hypothesis/adoption gate until the exact guest program has actually run.
7. Preserve visible row content, `data-call-id` and all non-label attributes.

The seven fixed cases are built from the exact original and patched source row,
`esc` and `recordTime`, using fictional records. The program is serialized only;
local tests do not evaluate the proposed code. It must run inside the existing
OS-qualified jail in a disposable VM. Node VM inside that jail is a test harness,
not the security boundary.

## Execution status and bounded qualification proposal

The new `call-row-source-tests-v1` is prepare-only. The existing agent dispatcher
rejects it. It supplies no provider, credential, grant, dispatch API, publication
or acceptance authority. Preparation and mocked OS outcomes do not qualify it.

One proposed Work-controlled qualification run would use the existing CallerCore
Vercel project/team and pinned universal image, 1 vCPU/2 GB, `iad1`, a five-minute
session maximum, 150-second command maximum, 20-second source-test maximum,
deny-all networking, no ports/secrets/drives, and `persistent:false`. Preserve the
23 isolation checks, exit and timeout controls, process termination, sanitized
test outcomes and verified stop. Create only once with a durable intent marker;
an uncertain acknowledgment is not permission to create another VM.

At the [published Vercel Sandbox rates](https://vercel.com/docs/sandbox/pricing),
five fully active minutes on one vCPU are $0.010667 and 2 GB for five minutes are
$0.003533; one creation is $0.0000006. A conservative 1 MiB transfer allowance at
$0.15/GB adds approximately $0.000157. The direct estimate is below $0.015 before
tax/provider adjustments, with a proposed $0.05 internal allowance. No custom
image build/import, persistent snapshot, drive or browser is proposed. Account
credits or billing totals are not assumed. The allowance is not a provider cap.

The standing rule separately controls new sandbox spending. Exact qualification
authorization, reviewed source/program identities and actual provider metadata
must be confirmed before creating this VM. No paid execution is granted by this
document. An actual failed source test must be preserved and block adoption;
it must not be relabeled a passed test or trigger automatic paid retries.

Even after a source-function run, browser accessibility-tree, keyboard/click and
assistive-technology checks remain separate. Internal-agent testing additionally
requires a reviewed qualification and fresh task-specific permission; old Starter
permissions and the completed model trial cannot authorize it.

## Actual isolated execution result — October 25, 2026

A separately approved single Work-controlled VM run on source7a3bd644a20c1ad9f1570464653687998430ef82 / c5948c27510a3425b0bb3c0898a99520dccddad395d1184346f7eb36453f519e / dpl_GeGt9mSioqoGyMEjMu9YhFgrJZCw captured its complete bounded receipt before shutdown. The1902-byte wire decoded to3643 bytes with raw SHA256 d470f8111d1655ee365b7c7384925338be3a7d649781615d41f4cbde50ae1675. Real command exit1, duration3272ms. All23 isolation probes, positive/seeded-failure controls and intentional timeout/descendant termination passed. Guest cleanupConfirmed:true; provider confirms stopped and no running sandboxes. The supervisor does not run its final protected-source integrity assertion after a failed product test, so that post-test check remains unverified.

Six behavior cases passed: baseline repeated-name collision, distinct valid-time labels, escaping and fallback text, missing caller/time fallback, the explicitly retained equal-timestamp limitation, and unchanged visible row content/attributes. The exact failure is invalid-time-is-an-adoption-blocker. The source helper returns any truthy numeric timestamp; the proposed label formats it without checking Date validity. An out-of-range numeric value therefore does not receive the required fallback. This is an observed failure for this run only; the prior truncated run's exact cause remains unknown.

The task itself also constrains the model to this defect: agent-operations-call-row-task-v1.json afterPattern requires precisely the unchecked formatter, and descriptorsv2-v5 inherit it unchanged. A valid Date guard cannot pass the current grammar. Independent Auditor addendum ac444b60f5aeaaba4a6f7d2adc882d8814d2ab827a1011ca43d399dc10f4569c confirms this constraint. Do not blame the Specialist alone or loosen the whole guard. Prepare a reviewed immutable successor contract that admits only an appropriate validity/fallback expression, preserves old descriptors/receipts, and adds the observed edge case to the Chief's acceptance criteria. The Specialist must author any revised patch in a future authorized model run. No such successor or new product patch is implemented by this addendum.

Next assignment must require: valid dates distinguish repeated callers; absent, non-finite and out-of-range timestamps use escaped fallback text; all non-label row content and click behavior remain unchanged; equal timestamps are explicitly reported as a limitation; acceptance criteria map to the exact source tests. Bind any new patch/test recipe to its own descriptor, source preimage and patch hash. Do not relabel the original failed patch as fixed or accepted.

The VM ran42.542s with3.928s active CPU,2GB memory and35758 total transfer bytes. Conservative calculated exposure is853micros(0.000853dollars), not an invoice. The one-run maximum0.05dollar approval is consumed and cannot be reused. No OpenAI calls, retries, product changes or publication occurred. Original model patch/reports/Auditor rejection and both qualification histories remain intact.

## Safe-time successor prepared — October 25, 2026

A separate immutable call-row-accessible-time-v6 contract now permits only the escaped label expression with a valid Date check before formatting and the existing fallback. Earlier v1-v5 descriptors and requests remain unchanged. Its Work-authored fixture is contract/test data, not a new agent-authored proposal. The three criteria cover invalid/missing/non-finite times, unchanged row behavior, and honest limitations/review outcomes. The successor retains the terminal engineering-report marker, concise final reporting, source identity and all existing guards.

The existing provider recognizes a distinct dormant safe-time policy. Exact serial lifecycle and UI journal lists include it; old policy hashes cannot authorize it and parallel prepared/active/consumed authority is denied. No environment/configuration, owner grant, model request, VM execution, product adoption or publication authority was activated. The current live default remains unchanged; selecting and qualifying a future exact-release task is separate.

A real-controller five-stage fixture with synthetic provider replies preserves the safe inert patch, separately attributed criticism and Auditor rejection, destroys its data-only copy and revokes authority. This does not run the revised code or establish live model quality. The old exact-patch VM recipe remains pinned to the old agent patch; it cannot test or qualify an unseen revised patch.

The adoption-review document was missing from the existing exact Vercel documentation allowlist. Its one exact path is now added and its audited declaration hash is registered alongside the prior hashes. Feature Preview/docs-only checks skip the build; mixed application changes, wrong environment/branch, missing comparison and lookalike documents still build. This is source selection only, not acceptance or authority.

## Successor source qualification

Source `36d5503` / fingerprint `33c4898c` / READY `dpl_D5R2aCDKA5vzR2guEPSGbg1kwjuq` passed 4,907 regressions, 35 real Redis checks, CodeQL, Jekyll, authenticated Browser QA and six visual comparisons. Independent QA and Auditor inspected the actual archive and screenshots. The successor remains inactive, fixture-only preparation; no new model proposal or revised-code execution is claimed. The original failed patch and Auditor rejection remain intact.

## Genuine safe-time revision and sealed test candidate — October 25, 2026

All five stages completed genuine gpt-6.1-sol/medium reasoning in workflow wf_270f19f564fa3326d8dc8350901ed646 on687b409/fe907/4nk2,346078ms. Specialist receipt584f84e73a1c1f53d59d8be24ec8ed78d81a3a41843c49f71a7ebd890541ecd0 produced actual patch22c3a0706d99fc5b3138c5d6d902f05e37fbc82d55f94126a3ca31cca36b714d / descriptor660abdd6588872d891c9dff6cae2fc895c777abb1a476fdbe659715adb5fe08c. It adds Date validity before formatting and preserves escaped fallback. Unique source replacement and full hashes independently recompute: a791baseline to aea8a45986d71205bcbc96ce8e0d362b16a63804be1452d72af51545aa10303f. Worker applied it only to a disposable copy and destroyed that copy. Product remains unchanged; no generated source executed.

Chief criteria were complete. Specialist supplied the safe bounded code, impact/risk/verification statements and criterion mapping. QA supported the static finding, but its uncertainty is exactly400characters and ends with unfinished wording. Auditor reason is exactly600characters and also ends unfinished; Auditor correctly rejected the unresolved report issue, and final Chief preserved that rejection. Parser inspection finds direct JSON decoding/schema validation, not host string truncation in the inspected provider/report path. Why the provider produced the unfinished wording remains unproven. Do not relabel it a decoder defect or silently repair model receipts. Shorter whole statements and less repeated hash narration are future contract improvements; neither publication nor another paid reporting attempt is justified by adding punctuation alone.

Independent genuine-run QA79cd1587ce47a0ae16edb7e47d7274779aa2bcfe07ac5e1d6372301d0c5e9862 and Auditor8d75a7b59dc0caf0b5dab58bc741325499f10ca8125267466243ceffa1190637 verify hashes, source scope, preserved rejection,36 prior owned workflows/36approvals unchanged and cleanup. Five Responses/five counts reported21581input3531output658reasoning tokens; Responses-only calculated0.078472dollars. Counting fees/invoice adjustments remain unknown. Approval revoked, leaseszero, attemptsclosed, sequence stopped.

Prepared Work-local candidate qualification_808443bc7ba44d57a90fd8629d5397d3 with new binding and existing fixed harness. It is a sealed temporary derivative, not a deployed backend profile, competing controller or internal-agent test grant. Only closed source-pair/patch/descriptor/import constants differ; reverse transforms recover all three original trusted modules exactly. Existing OS supervisor prefix is byte-identical and seven behavior cases unchanged. Actual new model patch and original receipt are bound; no model-authored code evaluated locally.27synthetic admission/provenance/outcome-parser checks pass, not actual behavior tests. Manifest8eb4cd150ac1a28fba27e5ab4b6968ec8cb03c49b5555004d4126b373106e86a, job1c7e7dbcd9c2d34cacfa379fd51c5b87fda2dd5f31f466e731da2a594c5f19a0, commandf96a6ef72f8ded0369435ce6df74ccb6e6a9d5b10fc2c01e8f92b5cae140e0c3, test6194133456befa2a66e1324299a21b167ab7492ee00f36c64f23297256b9f62f. Rebuild with the local sealed profile before dispatch and deep-compare the full job; serialized data alone is not WeakMap provenance. Independent QA ffcb12e2608aa8a773bbb50307f600b604559a9da7b0b29977b129458a523c93 / Auditor00c9de7e86df79310dd9697995fe996f98ade8556c4c3e8c4b0f125524e21a7f approve preparation only.

Fresh one-VM owner decision requested: existing pinned image, iad1,1CPU/2GB/fiveminutes,150scommand/20stest,deny-all/noports/secrets/drives/persistence,no retry,mandatory stop after capturing complete terminal result. Current published Sandbox rate calculation is approximately0.014358dollars for five fully active minutes plus conservative1MiBtransfer, before tax/rounding/provider adjustments; proposed maximum0.05dollars, not a provider hard cap. No image build/import/storage or app rebuild is requested. Earlier one-run approvals remain consumed; no VM started. On successful actual execution, independently verify all23isolation probes, seven source tests and protected-source integrity before considering Work-controlled Preview adoption. Browser accessibility-tree/keyboard and assistive-technology acceptance remain separate.

## Actual safe-time source tests passed — October 25, 2026

Standing owner sandbox testing authority now covers necessary, independently reviewed finite tests; earlier one-run approvals remain historical and are not reused. The first new VM exited0 but its success receipt was truncated at the MCP connector's observed2000-character string ceiling. Its individual outcomes remain unverified. A reviewed Work-local Brotli successor kept the same actual patch, guest code and seven cases while fitting complete hash-bound output below1900characters. No application or shared backend protocol change was required; the backend's direct16KB stream is separate from the MCP limit.

Fresh qualification_8921cee3a6f546ed93b61d0bc0e45d23 executed once in the existing deny-all, nonpersistent1CPU/2GB/iad1VM. Complete1731-byte wire/3876-byte report, actual exit0/3034ms beforestop, all7source tests and23isolation controls passed. Protected-source integrity, descendant termination and cleanup are verified. Provider confirms VM stopped. Rawreport77d0f2d72d4c1419e8f8239bf185706bf6b0736463e9bd15663bf2f15527b064; jobe818ffbc43a504563b4c300042820e3981e63d1e1be95e9b9435a1af7911e6d7; commandd781bc30f46da3f285d463b82ee258374cfbdd93db4d39ea287f3eb72f7b736f. Independent actualQA8aad108ae48361934889b793558dee74fdf7a10d5994dc08c3d452809b244634/Auditor37be3ed4fbe522800a71b97e97f9082f911bbd1cade27a35a03882f24eda4f07 approve fixed-case evidence.

The invalid/out-of-range label fallback now passes an actual isolated source-function test. Repeated callers at distinct valid times, escaping, missing-value fallbacks, equal-time limitation and unchanged non-label behavior also pass. This is Work-controlled verification, not an internal-agent dispatch grant or browser/screen-reader proof. Product is unchanged; old model report rejection remains preserved. A separate Work adoption review should decide whether to publish the patch to Preview and verify actual accessibility-tree names, keyboard/click behavior and responsive UI before acceptance claims.

Two VMs were created; estimated direct total0.001679dollars, not invoice reconciled. No OpenAI calls, app rebuilds, image imports, persisted snapshots or product publications occurred in this test pass.
