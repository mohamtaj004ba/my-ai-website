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
