# Provider singleton identity schema compatibility

Status: narrow provider-only workaround, not a verified live provider fix.

Provider support reported a structured-output initialization failure involving a fixed identity enum combined with a string pattern. The available raw responses did not disclose that cause. Original failure receipts, billing uncertainty and historical schemas remain unchanged; the support finding is separately attributed.

New assignments may explicitly opt into implementation-singleton-enum-v1. The Specialist provider schema removes pattern only from beforeSha256 and nine server-derived binding fields. Each field keeps type:string and its exact singleton enum. Before omission the builder verifies that the pinned string satisfies the original pattern; otherwise preparation fails closed. All other schema constraints and required/additionalProperties rules remain unchanged.

Internal response validation still uses the original patterns and exact enum values. Backend binding, source preimage, evidence, permission and review checks remain unchanged. This is not permission to strip arbitrary constraints or trust provider validation alone.

The former complete-prose objective and policy descriptors remain readback aliases. All five former v1/v2 request objects are frozen and reconstructed exactly in regression tests. Old consumed approvals are not selected as current authority.

Neither the resolved Starter task nor the resolved notification task is reopened by this schema change. A live compatibility attempt needs a fresh admissible task and exact-release controller authority. Metadata, fixtures and schema equivalence tests cannot prove a Responses request will succeed. Existing dedicated provider credentials are reused; no key creation or rotation is involved.
