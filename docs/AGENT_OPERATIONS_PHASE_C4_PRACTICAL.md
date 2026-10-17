# Phase C.4 practical draft milestone

The original Contacts search hypothesis was rejected: actual Chromium exposed its existing placeholder as an accessible name. It is not counted as a defect or proposed patch.

The confirmed source defect is `dashboard.js:619`: the daily overview chart begins at local midnight but ends each bin after exactly 86,400,000 milliseconds. In America/Los_Angeles, 2026-03-08 lasts 23 hours; that bin incorrectly includes the following day's 00:30 call. 2026-11-01 lasts 25 hours; that bin incorrectly omits the same day's 23:30 call. Deterministic date fixtures reproduce both directions; no customer occurrence is claimed.

Owner preset `dashboard-local-day-v1` extends existing five-stage engineering coordination, exact source retrieval, evidence-linked proposal, separate deterministic review, draft descriptor, and original restricted disposable child. One fixed reviewed replacement uses next local-calendar midnight. It is inert data: source is never executed. Only `dashboard.js` is copied; original source hash `441484e8a28273bb17eb0c1533b306935c30e00526a5cfc68a8e75b011fad5a6` and one occurrence bind the edit. Patch/preimage/postimage hashes and exact manifest are validated; cancellation, timeout and destruction use existing safeguards. Old fixed-comment profile and historical records remain valid.

Publication, semantic acceptance, paid inference, arbitrary edits/commands, network, repository mutation and deployments remain disabled. Original source files and source-lock remain unchanged. The 700000-byte bound applies only to the correction copy, because this actual JS source is 615026 bytes; legacy HTML demonstration remains capped at 200000 bytes. Node permissions constrain the trusted child, not arbitrary untrusted code or OS-wide CPU/memory/network capabilities. Abrupt parent termination remains an infrastructure limitation.

Independent QA/Auditor and hosted task verification are pending at this development checkpoint. Backend review deliberately remains unresolved; deterministic date reproduction is not independent AI judgment, human attestation, or owner publication approval.
