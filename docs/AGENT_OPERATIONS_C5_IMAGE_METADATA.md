# C.5 browser proposal: verified metadata addendum

This read-only follow-up supersedes the initial proposal's **unconfirmed base digest** limitation. It does not authorize a build or VM and does not change the frozen application release. The original manifest and failed metadata probe remain historical evidence.

At 2026-10-15T05:19:46Z, the public Microsoft Container Registry returned the official `playwright:v1.55.0-noble` index with one matching Linux/amd64 descriptor. A second metadata-only GET retrieved that platform manifest and its raw bytes hashed to exactly the descriptor digest:

`mcr.microsoft.com/playwright:v1.55.0-noble@sha256:ffc33305f7b4b04057ae4a0caa70aad4fde87454fb403a1a22e7f931707dfcf9`

The multi-platform index digest is `sha256:b27e719ecbfef153e13fd24e8341736733bf2658b229677eb21ff57ff5d7fb29`. Use the **Linux/amd64 platform digest** above for the reviewed recipe; do not substitute the mutable tag or assume an ARM image is compatible.

The manifest advertises four compressed layers totaling **913,944,629 bytes**, plus 4,338 bytes of configuration. No image layer or configuration blob was fetched. These are provider-advertised sizes, not a measured CallerCore output image, VCR optimized size, billed storage, transfer invoice or compatibility test.

At an illustrative $0.10 per decimal GB-month, the base layer total alone models about **$0.0914/month**. This does not establish the output registry charge: retained versions, optimization, account entitlements, new package layers, partial-month handling and transfer treatment require confirmation. The earlier two-GB/$0.20 example remains an illustration, not the measured size.

The five-minute 2-vCPU/4-GB iad1 compute model remains **$0.0284006**, excluding build/import, storage, transfer, tax and other account charges. Builder duration/rates and VCR import/egress treatment are still unquoted. No defensible all-inclusive cap is asserted.

## Exact decision before spending

First obtain the account-specific build/import and transfer quote and finite image retention plan. Then ask the owner to approve a **total monetary ceiling** covering one reviewed image build/import, explicitly bounded storage duration/bytes and transfer, plus **one** nonpersistent qualification VM with maximum two vCPUs/four GB/five minutes, one concurrent session, no retry/resume, no ports or snapshots, deny-all egress and independent stopped-state cleanup. Do not split unapproved charges into a compute-only allowance.

That approval must name the staged context, base digest, output digest/readiness verification, cleanup/retention policy and failure cutoffs. The existing manifest must be refreshed and independently reviewed before it becomes a spend-enabled build input; its original null fields are not operational configuration. A later protected Preview inspection additionally needs an explicit CallerCore-owned protection identity and exact egress policy. No Work cookies or credentials may be transferred.

The old $1 proof authorization and sixth session are not available. No image was built, pulled, pushed, imported or stored, and no VM or subscription was created during this metadata check. Local evidence: `C5_PUBLIC_IMAGE_MANIFEST.json` and `C5_PUBLIC_PLATFORM_MANIFEST.json` under the existing artifacts directory.

Primary pricing references: [Sandbox pricing](https://vercel.com/docs/sandbox/pricing), [registry limits and pricing](https://vercel.com/docs/container-registry/limits-and-pricing), and [official registry guide](https://vercel.com/kb/guide/how-to-use-vercel-container-registry). Metadata came directly from the public Microsoft registry, not a third-party image mirror.
