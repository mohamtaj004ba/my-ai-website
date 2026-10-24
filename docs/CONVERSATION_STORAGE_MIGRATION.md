# Conversation storage normalization

Status: implemented compatibility layer; isolated Preview seed dual-populates version 2. No production migration has been run.

## Storage contract

Legacy data remains at `conversations:<workspaceId>` as an array of complete conversation records. Version 2 uses:

- `conversations:v2:index:<workspaceId>` — a versioned directory of message-free summaries, contact keys, and activity/message counts.
- `conversations:v2:detail:<workspaceId>:<sha256 conversation id>` — one complete conversation record.

The authenticated workspace ID always determines each key. Request parameters never select a workspace.

## Safe publication order

`publishNormalizedConversations` validates the complete source array and rejects missing or duplicate conversation IDs. It then:

1. Writes every version 2 detail record in bounded batches.
2. Publishes the versioned index only after every detail succeeds.
3. Removes details that belonged only to the prior version 2 index, after the new index is readable.

The legacy array is not modified by this operation. A detail-write failure leaves the prior index active. This makes migration additive and reversible.

## Compatibility reads

- If no valid version 2 index exists, every list, detail, contact-history, dashboard-bundle, and export read uses the legacy array.
- If the version 2 index exists, ordinary list/sort/filter operations use only that bounded message-free index. A full-history text search reads the normalized detail records in bounded batches so message bodies are not duplicated into the index.
- Detail and contact-history operations read only the selected detail keys.
- If an indexed detail is unexpectedly absent, the reader falls back to the matching legacy record so an incomplete migration does not hide customer history.
- A malformed version 2 index fails closed. It is not silently treated as absence.

## Preview validation and production migration

The isolated Preview data seed keeps the legacy fixture and publishes version 2, so normal authenticated browser QA exercises normalized reads while retaining the rollback source. Empty generated admin workspaces also receive valid empty version 2 indexes.

Before any production migration is authorized:

1. Export and validate the target workspace.
2. Read the legacy array without changing it.
3. Publish version 2 with the shared helper.
4. Compare record IDs, message counts, contact keys, search results, and sampled complete histories.
5. Keep the legacy array throughout the compatibility period.
6. Monitor missing-detail fallback and malformed-index errors before considering legacy retirement.

Production migration is intentionally not exposed as a dashboard action or public route. It requires a separately authorized, workspace-scoped operational runbook.

## Rollback and deletion

Rollback deletes the detail keys enumerated by the active version 2 index and then deletes that index. With the index absent, reads immediately return to the untouched legacy array.

Permanent workspace purge deletes both legacy and version 2 conversation storage after the existing recovery-window, confirmation, and subscription gates. Workspace export always reconstructs complete histories from version 2 when present and otherwise uses legacy data.
