# Browser image proposal — offline preparation only

No image was pulled, built, imported, pushed or executed. No Sandbox session, provider credential, account or paid call was created. The prior $1 proof allowance is not renewed; its unused sixth slot supplies no current authority.

## Preserved failure and proposed correction

The fifth receipt `0499b2bc-4a06-4510-bcfc-917968b6292b` reports image `vercel/sandbox/universal@sha256:c77f7436b9bc0a8b01ef7b09dbcea2de6a18a9fe2aafa89996d2da193da72cf0`, 2 vCPUs/4 GB, 112,282,057 uploaded bytes and 20 unresolved `ldd` entries. It stopped before launch with `LINUX_SHARED_LIBRARIES_UNAVAILABLE`; missing names and actual VM distribution were not retained. All five historical sessions were recorded stopped. No previous screenshot or protected Preview inspection is inferred.

Use the official Playwright **1.55.0 Noble** image, which bakes browser system dependencies, rather than guessing twenty packages or installing them in a deny-all inspection session. Require its verified **linux/amd64 digest**, not an unfixed tag. That digest is currently missing, so this recipe is deliberately not build-ready. The image must contain the same original headless-shell bytes: offline extraction yielded SHA256 `a6bd350a143a92159c12291f336d2f3cc65ea501e521070d9ebb596c8c90a2a7`. Any mismatch fails before launch. Reuse the two already hashed npm archives; do not fetch newer packages implicitly.

Stage a clean build context containing only `c5-browser-image.Dockerfile`, `c5-browser-image-verify.cjs` and the two archives listed in the manifest. Never send the CallerCore checkout, `.env` files, Work credentials, browser cookies or customer records to a builder. The recipe executes no arbitrary proposed code and performs no runtime dependency installation. Its future build-time dependency check is an execution step requiring explicit infrastructure authorization, not permission granted by these files.

The future trusted controller must explicitly run the fixed qualifier as the non-root `pwuser`; Vercel does not execute image ENTRYPOINT/CMD. Qualify the exact pinned SDK/image/user combination before asserting compatibility. Missing user, filesystem permission, browser path or image readiness fails closed. `--fixed-fixture` captures only trusted local HTML; it establishes neither protected Preview authentication nor an operational hosted browser service.

Running as `pwuser` does not establish that Chromium's own OS sandbox is enabled. This fixed trusted fixture makes no Chromium sandbox or untrusted-page isolation claim; those require a separate supported configuration and verification before broader browsing.

## Separate owner decisions required

1. Approve the exact base digest, staged context and a bounded image build/import budget, including builder execution, VCR image storage and transfer. Those prices and account entitlements are not established here; do not treat a compute-only estimate as a build cap.
2. Approve **one** explicit nonpersistent qualification VM after the output image is VCR **Ready** and its digest is pinned. Proposed ceilings remain 2 vCPUs/4 GB, iad1, five-minute provider lifetime, four-minute work deadline, concurrency one, no ports, no snapshots/drives, deny-all egress, no retries/resume. Retain separate cleanup and independent stopped-state verification. No creation is authorized now.
3. Approve a distinct protected-Preview identity and exact network egress rules before any real page inspection. Work authentication must not be inherited. Keep credentials outside the VM, using a separately reviewed provider-supported boundary when needed. The fixed local fixture requires no identity.

## Pricing basis, not an authorization or guaranteed cap

Official iad1 rates checked for this proposal: active CPU $0.128/vCPU-hour, memory $0.0212/GB-hour, creation $0.60 per million. A fully active 2-vCPU/4-GB five-minute session models **$0.0284006** in compute plus creation. Enterprise transfer is $0.15/GB; Pro transfer is tied to Flat Rate CDN, so actual account pricing must be confirmed. Image builds/imports/storage, transfer, taxes, startup behavior and other account charges are excluded. No total purchase ceiling is invented and no new subscription is proposed. A fresh owner-approved total envelope must be established before spending.

## Evidence still required

Verify the base/platform digest; obtain builder/registry pricing; review image layers and absence of secrets; build and capture native-library names plus `/etc/os-release` ID/version; confirm zero loader failures and actual browser launch; verify the fixed PNG/hash/geometry; demonstrate runtime deny-all/non-root isolation, timeout/cancellation and independent cleanup. Reuse prior successful upload evidence without repeating five failed sessions. A new container build or VM is not necessary to complete this offline proposal.

Primary sources: [pinned Playwright 1.55.0 recipe](https://raw.githubusercontent.com/microsoft/playwright/v1.55.0/utils/docker/Dockerfile.noble), [pinned dependency definitions](https://raw.githubusercontent.com/microsoft/playwright/v1.55.0/packages/playwright-core/src/server/registry/nativeDeps.ts), [Playwright image security and version matching](https://playwright.dev/docs/docker), [Vercel image readiness and digests](https://vercel.com/docs/sandbox/concepts/images), [Sandbox pricing](https://vercel.com/docs/sandbox/pricing).

## Cost worksheet and image reuse

| Component | Verified basis | Remaining amount/condition |
| --- | --- | --- |
| One five-minute 2-vCPU/4-GB qualification | iad1 rates above; modeled $0.0284006 | Estimate assumes both CPUs active for the full session; not an invoice or provider cap |
| Image build/import | No build run or quote obtained | Builder type, duration and account charge unknown; no zero-cost claim |
| VCR storage | [Registry pricing](https://vercel.com/docs/container-registry/limits-and-pricing) lists $0.10/GB; [official guide](https://vercel.com/kb/guide/how-to-use-vercel-container-registry) describes GB/month | Actual compressed image size, retention, optimized storage and account billing must be verified; illustrative 2 GB retained one month would be $0.20, not a measured size |
| Transfer | Sandbox Enterprise reference $0.15/GB; Pro follows Flat Rate CDN | Image import/pull and evidence transfer treatment/account rates unresolved; illustrative 10 MB at $0.15/GB is $0.0015 |
| Snapshot/drive storage | Nonpersistent VM, no snapshots or drives proposed | No intentional snapshot/drive storage; do not infer zero registry storage |

A single public registry manifest GET was attempted without credentials or image pull; local transport returned `HttpRequestException`, so the base digest remains **unconfirmed**. No retry, image pull, registry write or purchase followed. An authorized read-only metadata check may resolve the digest later; it is not permission to launch a builder or VM.

The manifest copies the official pinned `ubuntu24.04-x64` Chromium and tool dependency lists, not guessed missing-package names. The official image already includes those browser dependencies. Verify its actual package versions and layer SBOM at qualification; a digest is required to pin the complete installed environment. SDK 3.3.0 remains the existing controller pin; custom-image path, non-root-user execution and Ready-image compatibility must be demonstrated rather than assumed.

Reuse one reviewed output digest for unchanged browser/package/qualifier inputs. Do not rebuild for application documentation or unrelated UI changes. Rebuild only for changed security/dependency requirements or deliberately updated browser assets, with a new reviewed manifest. Establish a finite retention/cleanup policy and a quoted total envelope before requesting any build/store/launch authorization; no unbounded purchase is requested here.
