# Chief source discovery

This extends the existing Chief request/parser with read-only engineering intake. It does not add a provider transport or replace the five-stage workflow.

From a clean, committed checkout:

```powershell
node scripts/prepare-chief-discovery.cjs chief-survey-001
```

The exclusive local artifact contains a current-source catalog, sampled excerpts, exact source/release identity and a prepared GPT-6.1 Sol Medium request. No API call occurs. The Chief may propose an investigation, request more source IDs, or hold. Catalog names alone cannot substantiate a finding.

To prepare contiguous source excerpts:

```powershell
node scripts/prepare-chief-discovery.cjs chief-read-001 --read source-10
```

Each excerpt records its exact line range, source hash and excerpt hash. Ranges may be partial. Coverage is limited to the existing approved source capture; it is not a whole-repository or runtime/browser inspection.

An existing response export can be validated offline:

```powershell
node scripts/review-chief-discovery.cjs chief-survey-001 preserved-chief-response chief-draft-001
```

Only safe artifact basenames are accepted. The import uses the existing Chief parser and labels provider provenance unverified. An `inspect` result prepares the next source-read request. An `investigate` result preserves the proposed problem, user impact, criteria, exclusions, uncertainty and cited source. Neither result creates a registered task or authorizes inference, patches, tests, acceptance or publication.

Live discovery still requires integration with the existing authenticated task/controller path, token counting, exact deployment binding, audit receipts, cancellation and cleanup. Local fixtures/imports do not demonstrate genuine model discovery or operational five-stage completion. No paid call should be made directly from these preparation scripts.
