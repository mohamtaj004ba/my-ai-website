# Observed Preview voice costs

Observed: 2026-10-06, from the signed-in Vapi Logs table.

This is test evidence, not a provider quote or a production pricing recommendation. No new calls or credit purchases were made for this review.

## Visible inbound-call sample

The first log page contained 14 inbound calls to the isolated internal/demo assistants:

- Displayed duration: 1,459 seconds, or approximately 24.32 minutes.
- Sum of displayed call charges: $2.53.
- Arithmetic ratio: approximately $0.104 per displayed minute.
- The demo entry showed 2m 57s and $0.31.

Outbound synthetic caller legs were excluded from this ratio. Their separate costs still matter when reconciling the acceptance-test budget; a two-agent test can incur charges on both legs. The sample is one visible page, not the complete account history. It includes several assistant revisions and is not an evaluation of the final voice configuration alone.

The table rounds displayed charges to cents. Invoice reconciliation, telephony charges outside that table, fixed costs, infrastructure costs and a representative production call mix were not verified by this observation. Do not equate this ratio with fully loaded customer cost or profit margin.

## Next cost evidence to collect

After conversational acceptance, record the final assistant revision, exact provider cost breakdown, connected duration, caller mix and any separate phone charges for a larger controlled sample. Reconcile the complete test budget including synthetic caller legs. Keep customer usage accounting separate from provider charges; automatic overage billing remains disabled.

The September `VOICE_UNIT_ECONOMICS.md` is historical planning. Its separate transcription/model/synthesis assumptions should not be used as the current GPT-Live cost breakdown.
