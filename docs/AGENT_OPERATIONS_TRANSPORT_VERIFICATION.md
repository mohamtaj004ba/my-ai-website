# Non-billable supervisor and remote-worker verification

The existing owner session starts supervisePilot. A separate restricted worker runs runWorker/createRemote against the same pinned Preview and shared isolated Redis namespace. The fixed nonbillable-supervisor-transport-v1 profile has authorized=false, zero calls and zero spending. Its only worker operations are bootstrap, initialize-once, read, five ordered boundary transitions and completion. There is no provider/tool/capture/assessor/spending operation. Operational organization initialization remains paid-gated and unchanged. Test tasks are explicitly not accepted work.

Threat/failure analysis: distinguish real remote HTTP transport from synthetic task transitions. Namespace, owner, runtime, release, capability, revision, finite window, deadline and central approval remain checked at each consequential operation. Failed initialization responses are never retried. Cancellation revokes centrally; controller disappearance alone has bounded lease limitations. Cleanup/readback remains owner-only after the finite window closes, while all worker operations are denied.

Hosted plan: success, startup failure, worker interruption/crash, timeout, browser cancellation, explicit revocation, stale release, partial initialization, controller disconnect and failed cleanup/recovery. Capture distinct task IDs, separate owner/worker histories, actual request IDs where available, task revisions and central old/replacement readbacks. Preserve rate-limit or network failures rather than silently retrying. This proves transport/lifecycle behavior only, not paid-provider behavior or substantive visual accuracy.

Implementation verification and hosted results are pending. Paid execution and autonomous writes remain disabled.
