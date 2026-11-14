# Source-only OS execution qualification — inert plan

This is an owner-reviewable plan, not an executable runner or spending authorization. No untrusted source has run. Resolve provider hard limits and complete costs before requesting one separately authorized qualification session. Dedicated browser image/authentication qualification remains separate.

```json
{
  "version": "phase-d-source-only-qualification-plan-v1",
  "status": "inert-preparation-not-executable-or-authorized",
  "createdOn": "2026-10-16",
  "resourceCreated": false,
  "generatedCodeExecuted": false,
  "paidAuthority": false,
  "candidate": {
    "provider": "existing Vercel Sandbox project",
    "image": "managed Node-capable linux/amd64 image; exact immutable digest still REQUIRED",
    "sdkObservedLocally": "@vercel/sandbox 3.3.0 source/types only",
    "region": "iad1",
    "vcpus": 1,
    "allocatedMemoryMb": 2048,
    "persistent": false,
    "networkPolicy": "deny-all",
    "ports": [],
    "drives": [],
    "snapshotAllowed": false,
    "resumeAllowed": false,
    "extendTimeoutAllowed": false,
    "providerTimeoutMs": 300000,
    "trustedWorkDeadlineMs": 240000,
    "concurrency": 1,
    "controlPlaneCredentialInsideGuest": false,
    "environmentSecretsAllowed": false,
    "taskOrModelSelectsCommands": false,
    "automaticRetry": false
  },
  "admissionPrerequisites": [
    "Separate owner approval of exact provider resources, transfer/failure costs and total internal exposure",
    "Exact image digest plus account/project/region and returned resource configuration",
    "Fixed runner and tests signed by independently reviewed hash manifest; agent cannot edit runner/tests",
    "Exact approved source snapshot with task/workspace/source/release/execution/fence/authority revision",
    "No package install, git clone, package script, dynamic module download, browser or model inference",
    "Qualified hard guest limit mechanism and no privilege escalation before any hostile or generated source",
    "Independent cancellation authority, finite provider lifetime and available stop/readback control plane"
  ],
  "layers": {
    "A": "Trusted metadata and fixed successful/seeded-failure probes ONLY, after resource approval",
    "B": "Fixed adversarial boundary probes ONLY after layer A establishes the needed hard limits",
    "C": "Agent-generated source execution stays disabled until independent acceptance of A/B and a separately authorized execution class"
  },
  "probes": [
    {
      "id": "identity-and-image",
      "layer": "A",
      "operation": "Trusted runner records image/runtime/kernel identity, non-root UID/GID/group names, effective capability mask and selected mount/resource metadata; never environment values or credentials",
      "pass": "Exact approved image/runtime/resource identity; task UID is non-root and distinct from runner/test owner",
      "fail": "Mismatch, privileged task identity or missing bounded evidence",
      "failureCode": "QUAL_IDENTITY_UNVERIFIED"
    },
    {
      "id": "privilege-confinement",
      "layer": "A then B",
      "operation": "Inspect effective groups/capabilities/sudo configuration and setuid exposure; then one fixed noninteractive negative escalation probe only after reviewed policy permits it",
      "pass": "Task has no effective elevation path; privileged SDK methods remain controller-only and absent from task input",
      "fail": "Root acquisition, privileged group/capabilities, usable elevation path or inspection uncertainty",
      "providerClarification": "createUser private-home semantics do not by themselves prove non-sudo guest policy",
      "failureCode": "QUAL_PRIVILEGE_UNVERIFIED"
    },
    {
      "id": "filesystem-confinement",
      "layer": "A then B",
      "operation": "Stage synthetic protected runner/test sentinel files owned by trusted UID; task writes a 1KiB allowed output; attempt fixed writes to synthetic forbidden sibling, runner and root-owned sentinels; test one symlink output escape",
      "pass": "Only task output directory writable; all forbidden writes denied, protected hashes unchanged and symlink output rejected",
      "fail": "Any forbidden write or source/test mutation; access outside reviewed writable directories remains unbounded",
      "providerClarification": "Need qualified read-only mount/namespace or equivalent filesystem policy; ordinary non-root user is not a jail",
      "failureCode": "QUAL_FILESYSTEM_UNVERIFIED"
    },
    {
      "id": "process-ceiling",
      "layer": "A then B",
      "operation": "Attest effective PID/task limit for complete process tree; only afterward a fixed finite child probe at the approved limit plus one attempted child",
      "pass": "Extra process denied; all allowed descendants accounted for and killed with session; no detached survivor",
      "fail": "No effective tree-wide limit, uncontrolled fork path or survivor",
      "providerClarification": "SDK create resources do not establish a per-task PID ceiling; select and qualify mechanism first",
      "failureCode": "QUAL_PROCESS_LIMIT_UNVERIFIED"
    },
    {
      "id": "disk-ceiling",
      "layer": "A then B",
      "operation": "Attest actual writable-filesystem quota; afterward fixed writes up to approved small quota and one additional 1KiB block; reject any oversized artifact before downloading",
      "pass": "Hard allocation stops at approved bound across all task-writable paths; runner remains available; retained output stays under transport cap",
      "fail": "Only per-file limit or provider-wide 64GB allocation exists, other writable paths bypass quota or controller cannot collect cleanup evidence",
      "providerClarification": "Per-task hard quota not documented; tmpfs/cgroup/other mechanism availability and permissions must be verified first",
      "failureCode": "QUAL_DISK_LIMIT_UNVERIFIED"
    },
    {
      "id": "cpu-memory-and-time",
      "layer": "A then B",
      "operation": "Attest allocated CPU/RAM and effective tree-wide CPU/memory ceilings; afterward fixed bounded allocation and CPU probes using a trusted watchdog; never an unbounded stress loop",
      "pass": "Approved total limits actually terminate probe safely; controller remains responsive; outer deadline cannot be extended by task",
      "fail": "Only V8 old-space, per-process limits with descendant bypass, unverifiable quota or timeout-extension authority",
      "providerClarification": "Allocated VM vCPU/RAM does not independently prove finer guest task quotas; resource mechanisms and measurement need qualification",
      "failureCode": "QUAL_RESOURCE_LIMIT_UNVERIFIED"
    },
    {
      "id": "deny-all-egress",
      "layer": "B",
      "operation": "Verify returned deny-all policy; fixed DNS lookup and bounded connection attempts to approved public, loopback, private and link-local test destinations with tiny deadlines, no payload or credentials",
      "pass": "No external/private egress or DNS access; local task service paths explicitly denied by process/filesystem plan",
      "fail": "Unexpected connectivity, DNS leakage, permissive policy or request-derived policy change",
      "providerClarification": "Loopback behavior needs separate process-boundary policy; provider egress denial alone is not same-VM isolation",
      "failureCode": "QUAL_EGRESS_UNVERIFIED"
    },
    {
      "id": "fixed-test-result-and-integrity",
      "layer": "A",
      "operation": "Run one fixed dependency-free Node assertion that passes, then one seeded assertion that fails; collect bounded sanitized exit facts and exact source/test hashes",
      "pass": "Both expected exit results, no suppressed failing result, original repository and trusted test hashes unchanged",
      "fail": "False green, altered test, substituted source or missing receipt",
      "failureCode": "QUAL_RESULT_INTEGRITY"
    },
    {
      "id": "cancel-emergency-stop-cleanup",
      "layer": "B",
      "operation": "Cancel a fixed finite sleeper with one fixed finite descendant, revoke task grant, stop entire session and independently query provider state; no automatic resume or second session",
      "pass": "Parent and descendant terminate, stopped/deleted state confirmed, grants/leases zero, no snapshot/drive retained; source and evidence hashes preserved",
      "fail": "Unknown provider state, surviving work, missing receipt, cleanup timeout or revoked grant can resume",
      "failureCode": "QUAL_CLEANUP_UNVERIFIED"
    }
  ],
  "requiredReceiptFields": [
    "taskId",
    "executionId",
    "workspaceHash",
    "sourceCommit",
    "sourceManifestHash",
    "releaseFingerprint",
    "imageDigest",
    "sdkVersion",
    "sandboxId",
    "probeId",
    "expectedOutcome",
    "observedSanitizedOutcome",
    "sourceHashBefore",
    "sourceHashAfter",
    "testManifestHash",
    "startedAt",
    "finishedAt",
    "exitClassification",
    "resourceSettings",
    "providerUsageWhereAvailable",
    "cleanupState",
    "receiptHash"
  ],
  "evidenceRestrictions": [
    "No raw stdout, environment, credentials, arbitrary URLs, customer data or rejected model content",
    "Bounded allowlisted paths and stable codes only",
    "Preserve failure evidence; no automatic retry or semantic acceptance"
  ],
  "costStatus": {
    "computeCreationOnlyEstimateUsd": 0.0142006,
    "basis": "Five fully active minutes, iad1, 1vCPU/2GB; published rates, not account quote",
    "unknown": [
      "Control-plane artifact-transfer metering",
      "Provider failure/cleanup adjustments",
      "Guest quota implementation feasibility",
      "Account-specific remaining minimum/adjustment treatment and full bounded quote"
    ],
    "browserAdditionalUnknown": [
      "Custom image build and import",
      "VCR storage billing cadence and actual optimized size",
      "Finite retention and transfer",
      "CallerCore-owned protected Preview broker and synthetic read-only identity"
    ],
    "allInclusiveCeilingVerified": false,
    "existingBrowserAllowanceReusable": false,
    "openAiBudgetCoversSandbox": false,
    "accountObservation": "Pro; $20 included credit displayed fully used; UI observation, not invoice/this-work attribution"
  },
  "localAlternative": "Bounded read-only inventory found WSL uninstalled and no qualified Docker/Podman/Windows Sandbox installation; no software started or installed.",
  "nextAction": "Non-billably resolve guest hard quota support and account-specific cost terms; independently review this fixed plan. Only afterward request one exact owner resource/spending authorization. No hostile/generated execution is currently permitted."
}
```

## Offline layer-A inventory prepared — October 22, 2026

`scripts/source-execution-inventory.cjs` now supplies the first fixed trusted read-only inventory from this plan. It reads only `/proc/self/status`, `/proc/self/limits` and `/sys/fs/cgroup/cgroup.controllers`, at most 65,536 bytes per file, and emits closed sanitized observations. No environment, raw file text, process execution, network, writes, provider SDK, credentials or provisioning is used. Non-Linux execution returns `QUAL_PLATFORM_UNSUPPORTED` without reading Linux paths.

It observes UID/root state, effective capabilities, no-new-privileges, seccomp mode, individual resource-limit classifications and available controller names. Missing, duplicate, oversized, malformed, out-of-range UID and contradictory limit evidence stays unknown. A controller's availability is not proof of effective task membership or enforcement; per-process limits do not prove descendant limits. Output always has `qualified:false` and `generatedCodeExecutionAllowed:false`. It cannot attest image identity, filesystem confinement, sudo paths, effective task cgroups, egress or cleanup. Those remain explicit unresolved qualification items.

Six fixture tests plus seven independent QA boundary checks passed. Initial QA findings on UID range, soft/hard ordering and empty controller lists were corrected; original review preserved. Final QA receipt SHA c86231246f0974526a42d583dae68a30f632cf956814d76e369b3524e6aab3f8. Initial independent Auditor passed five checks plus thirteen adversarial checks with no material security issue; the subsequent QA corrections tighten observation validity only. No actual Linux guest or generated source ran.

This tool is offline preparation, not a qualified sandbox or an application runtime integration. Preserve it locally for the next reviewed source batch; do not trigger a separate Preview application build merely to ship an unused operator probe. The verified Preview remains the existing 149ed7a application. Full source-batch release qualification remains pending. No sandbox or model spending occurred.

Official firewall documentation reconfirms explicit `deny-all` blocks outbound access including DNS: https://vercel.com/docs/sandbox/concepts/firewall . Pricing remains https://vercel.com/docs/sandbox/pricing ; existing compute estimate is not a new all-inclusive account quote. Managed source-only qualification does not depend on the custom Playwright browser image or protected Preview identity. New infrastructure authorization and remaining provider/resource qualification are still required before a guest session.

## Actual privilege-drop check verified

The follow-up managed VM ran the fixed `scripts/source-execution-privilege-probe.cjs` command successfully: UID/GID65534, no supplementary groups, NoNewPrivs set and all five capability sets empty. All nine facts and complete source hash matched independent QA/Auditor readback. The VM was stopped, with no snapshot. This is actual trusted Linux evidence, not merely a fixture.

The executable need not be root-owned when it and every ancestor are protected from the target UID and groups. Actual `/usr/local/bin/node` was owned by the trusted launcher user, and fixed read-only path/ownership checks verified protection without changing permissions. Future dispatch must preserve this distinction and cannot run model code as the trusted launcher. The exact reviewed privilege command is data, not authority; current backend has no integration that admits arbitrary commands.

No generated code ran. Full filesystem/resource/egress/cancellation and source/test integrity qualification remains incomplete; existing no-execution/no-publication restrictions remain. Details and actual receipts are in the newest canonical checkpoint.
