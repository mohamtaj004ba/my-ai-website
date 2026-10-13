# Bounded organizational lease renewal

## Supported cause and limits

Preserved run9e63 proves a10985ms UND_ERR_CONNECT_TIMEOUT on worker broker renewal, capture interruption and eventual30s lease expiry. cd987's initiating cause is still unproved. No evidence attributes the network fault to Chrome, Redis, Vercel or a local network. Existing renewal required protected authority GET plus revision-changing POST, with a10s cadence and15s request deadlines; realistic latency could consume the entire30s lease. This is a timing/control-plane design weakness, not proof of the network's root location.

## Correction

The existing organization-command route accepts renew-lease-v1 only with the task capability and exact pending execution, stage, fence, approval and release hashes. Central grant/approval, original live tasklease,150s stage and10m workflow deadline checks precede replay handling. A monotonic sequence (maximum40 per stage) identifies each renewal. Same sequence returns the original receipt without another extension, audit or ledger mutation; stale/gapped sequence fails. Renewal cannot change semantic taskrevision, spending, stage outputs or acceptance. Receipt explicitly binds runtime origin/source, task, execution, fence, stage, approval/release and fixed deadlines.

The tracked trusted parent owns a singleflight5s pump. Each request is bounded4s even if transport ignores abort; only an allowlisted transport failure may repeat the identical sequence once while the previously confirmed lease retains a safety margin. HTTP denials, Redis errors and unknown errors stop. No provider, initialization, spending or stage transition retries are added. Parent abort interrupts parent capture and kills the restricted child. Child cannot disable this mandatory pump; in-process legacy paths retain their existing heartbeat. Pump remains active through evidence processing, then obtains a final confirmed lease and drains before finish. Semantic finalization remains one atomic backend operation. Supervisor treats execution-bound monotonic renewal as liveness, separately enforcing stage deadline; new claim clears prior-stage liveness.

## Verification status

14 lease/pump regressions passed, including real harmless lifecycle prepare/activate/consume, lostreply no-op, concurrent sequence, cancelled/expired/revoked grants/approval, mismatched release/deployment, unchanged Chief binding under own approvalrenewal and denial after unrelated ledger changes, unavailable storage and ignored abort. Actual authenticated-handler/supervisor/restricted-fork offline long-stage rehearsal passed with35s capture and a committed lostreply; all5 stages/5reservations, final report and revoke completed. This is offline integration evidence, not hosted completion. Exact new-source full/contracts/CI/Redis/CodeQL/Browser and actual hosted profiles are still pending. Paid execution stays disabled; historical15/7/2.20/8 accounting preserved.

## Residual restrictions

Chief pre-dispatch construction intentionally does not renew because a ledger mutation would invalidate its verified context snapshot. It must complete within its original30s lease, otherwise stop without paid dispatch. Requests already transmitted cannot be recalled. Arbitrary outages beyond confirmed authority must stop, never revive. Hosted cloud hardkill/Redis outage remain distinct from faithful offline injections. General visual/Legal suitability acceptance still requires trusted substantive review; capture-time deterministic price-spacing is the only automatic acceptance oracle. No paid-pilot readiness until full actual hosted path and shutdown are independently verified.
