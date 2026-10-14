# Phase C.4 hosted browser decision and independent challenge

Reviewed 2026-10-14. This record describes a proposed deployment, not a provisioned service. No sandbox, credential, paid capture, account or recurring infrastructure was created. The C.3 local Chromium fixture remains local rendering evidence only.

## Recommended next boundary

Use the existing CallerCore Vercel project with a separately authorized ephemeral Vercel Sandbox, rather than embedding Chromium in ordinary application Functions. Sandbox provides a Firecracker microVM and provider-enforced outbound firewall. This is a fit with the existing provider, not proof the current project has usable Sandbox entitlement or approved spending. [Official overview](https://vercel.com/docs/sandbox).

The existing `lib/agent-operations-browser-service.js` rejects execution unless dedicated infrastructure and independently verified egress isolation are supplied. Keep this fail-closed gate until the following deployment proof exists:

1. The existing authenticated owner/task gateway admits an exact task, execution, source, deployment, release, URL and viewport. Revalidate central cancellation/revocation immediately before creation, navigation, and evidence acceptance. Persist the provider sandbox ID before starting capture; admission/lease is atomic in the existing Redis journal.
2. Use one disposable VM per bounded inspection, concurrency one initially, 1 vCPU/2 GB, `persistent: false`, no drives/snapshots, no exposed ports, and a short hard session timeout. Chromium availability and memory sufficiency require a real authorized qualification run. A pinned image/browser package must be prepared through trusted build tooling; models cannot choose installation commands or image tags.
3. Start with deny-all egress, then an exact hashed Preview hostname allowlist and explicit private/loopback/link-local/metadata/reserved subnet denial. No wildcard domains. Provider firewall enforces connection-time egress; Playwright GET/path interception remains defense in depth. Test redirects, DNS changes, IPv6, direct IP URLs, browser-internal requests and disallowed resource origins on the actual service. A successful allowlist configuration alone is not evidence every negative path works. [Sandbox firewall](https://vercel.com/docs/sandbox/concepts/firewall).
4. The trusted server controls the SDK and lifecycle. Vercel recommends deployment OIDC for Sandbox API authentication; this authenticates the controller, not protected Preview browsing. Never pass controller OIDC, provider API credentials or Work browser state into the VM/model. [Sandbox authentication](https://vercel.com/docs/sandbox/concepts/authentication).
5. Protected Preview needs its own approved identity mechanism. Prefer server/firewall-brokered narrow authentication, exact-host binding and no secret in VM, DOM, URL, diagnostics or evidence. Vercel Deployment Protection access and CallerCore application owner login are distinct. Until that mechanism is explicitly configured and proved, protected pages remain unavailable; do not disable protection or reuse Work cookies.
6. Fixed runner only: existing public root/Legal path policy, desktop/mobile presets, JavaScript disabled, GET-only requests, no forms/downloads/uploads, new context, sanitized diagnostics and bounded PNG/text/geometry. Captured source must be independently compared with the actual served release; a caller-supplied SHA alone does not prove release identity. Customer/admin pages require a separate narrow policy and identity review, not an implicit expansion of the public policy.
7. Capture receipts bind task/execution/source/deployment/release, URL, viewport, capture time, PNG hash, geometry, and cleanup. Treat page content as untrusted evidence, never tool instructions. Retain original bytes in the existing evidence architecture with access checks and byte limits.
8. Stop the VM in `finally`, on cancellation and on central revocation; verify stopped state separately. A watchdog reconciles persisted sandbox IDs after controller termination, and blocks new work on uncertain cleanup. Provider timeout is the final limit, not a replacement for explicit cleanup. No automatic replay or recreation after failure.

The present in-process `active` slot and context/browser-close receipts are not host-wide isolation, durable concurrency or provider cleanup evidence. The proposed remote adapter must preserve existing authorization, leases and evidence persistence, rather than making those caller assertions.

## Cost and exact owner decision

Official `iad1` rates inspected 2026-10-14: active CPU $0.128/hour, provisioned memory $0.0212/GB-hour, creation $0.60/million, outgoing transfer $0.15/GB; regional rates differ. Memory has a one-minute minimum. Pro usage consumes plan credit and then bills; Hobby has quotas and pauses at exhaustion. Current CallerCore plan/remaining credit was not established by this documentation review. [Pricing](https://vercel.com/docs/sandbox/pricing).

Conservative planning example: 1 vCPU fully active for one minute, 2 GB memory for one minute, one creation and 10 MB outgoing evidence is approximately $0.00434 before taxes/other platform or image costs. Four separately created captures at that envelope are approximately $0.01736. This is a planning estimate, not a billing cap; browser installation, startup, retries, transfer, storage or longer sessions can increase charges. No inference/model cost is included. Do not charge this infrastructure against the internal API ledger without a separately approved policy.

Owner decision required: authorize one explicitly capped Vercel Sandbox qualification on the existing project, specify an infrastructure spending ceiling and approved region/retention, and authorize a narrowly scoped protected Preview access mechanism if protected targets are required. Approval must not imply recurring workloads, production access, unrestricted network, repository publication or paid AI calls. Until then browser dispatch stays disabled; local fixture and contract tests can continue.

## Next predictable operational gaps

| Boundary | Confirmed current limitation | Required evidence before operational claim |
|---|---|---|
| GitHub | Public reads do not establish private GitHub App access. App registration/installation/token broker is distinct from Work connector access. | Exact repository installation, authenticated installation identity, minimum read permissions, token expiry, revoked-token denial, and no write route. Never infer connection from repository existence. |
| Vercel | Work CLI access is not CallerCore agent authorization; broad team tokens are not project-only read credentials. | Approved project integration/service identity, actual project/team/source metadata, Preview-only endpoint policy, sanitized output, scope expiry/revocation tests. Never return env values or raw log bodies to models. |
| Browser | Runtime/binary, egress and protected-target identity are not operationally verified. | Real owner-authorized VM capture through existing gateway, exact release comparison, denied-origin tests, cancellation and provider cleanup receipts. |
| Draft workspace | Existing fixed-data process demonstration is not an untrusted-code sandbox. | Inert allowlisted patch preparation may proceed without executing generated code. Real generated test execution needs separately proved VM isolation and resource/network controls. |

## Independent acceptance checks

Reject any implementation that marks a setup request as connected, trusts a model-supplied egress flag, inherits Work cookies or credentials, treats request mocks as provider authentication evidence, or accepts stale findings after source/patch changes. A service token must remain server-only and independently bound to owner/workspace/provider/account/resource/environment. Revoke must prevent new dispatch before and after provider response; late evidence cannot resurrect authority. Any new remote adapter requires STRICT negative-path tests and independent review of actual transport, not only its catalogue entry.
