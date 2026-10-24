# Dedicated public browser boundary

Responsive capture uses only the fixed `desktop` (1280×900, default) or `mobile` (390×844) viewport preset. Arbitrary dimensions are rejected; the actual dimensions are retained in the capture evidence.

`lib/agent-operations-browser-service.js` is an unprovisioned dedicated-runtime capture implementation. It is not wired into ordinary Vercel Functions or enabled by the gateway. Existing ChatGPT browser credentials are never accepted. Playwright 1.55.0 is pinned by the existing project; a browser executable and isolated browser host must be provisioned separately.

The trusted caller supplies an already-authorized task/execution and exact Preview source binding. Only the exact hashed CallerCore Preview origin and root/Legal navigation are accepted. Requests use GET, same-origin resources, public IPv4 DNS responses, and bounded capture limits. JavaScript, service workers, permissions and downloads are disabled; a new context is destroyed for every capture. No cookie, storage-state, header, upload, script or credential arguments are accepted. Output text is untrusted page content and must never grant instructions or permissions. Diagnostics contain enum types only. PNG bytes and SHA-256 are returned to the trusted evidence store, never written to arbitrary paths.

## Activation prerequisites — currently unavailable

- Dedicated process/container host with Chromium and resource limits, no host secrets or customer data.
- Independently verified outbound firewall/proxy enforcing public IPs and the exact approved origin at connection time, including DNS rebinding, redirects, IPv6 and browser-internal traffic. Playwright interception plus DNS lookup alone cannot guarantee this: the browser resolves DNS independently and browser-level traffic may evade page routes. `egressIsolationVerified` is a trusted operator assertion, not a self-attestation an agent may set.
- Authenticated service transport, per-task authorization, central revocation and cancellation integration through the unified gateway. Do not expose this module as an unauthenticated HTTP endpoint.
- Capture-time remote release-identity verification. Caller-supplied source SHA is provenance binding, not proof the server served that SHA. Protected Preview authentication is unavailable; no bypass credential is created.
- OS CPU/memory/process/concurrency enforcement. Current implementation provides one in-process capture and deadlines, not a host-wide quota or security sandbox.

Therefore remote browser inspection remains **disabled / infrastructure required**. No new provider, subscription, credential or billable capture was activated. Contract tests exercise denial and sanitation, not genuine remote capture. A local `setContent` fixture, if run, demonstrates only Chromium rendering and cleanup, never deployed Preview inspection.

Lifecycle bounds: Playwright launch has a 10-second timeout; capture has a 20-second deadline after launch and a 30-second total work deadline. Each awaited capture operation races the remaining deadline. Cleanup allows two seconds each for context and browser close, giving a nominal maximum of 34 seconds with a responsive Node event loop and Playwright honoring launch timeout. These are application bounds, not an OS process-kill guarantee; host watchdog/process termination remains a provisioning requirement. Cancellation is checked immediately after launch and immediately before navigation. Successful output includes confirmed close receipts. Failed close receipts reject the capture as `BROWSER_CLEANUP_UNCONFIRMED` and quarantine the process concurrency slot, preventing new captures until an operator replaces the process.
