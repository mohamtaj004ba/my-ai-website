# Make a fix cover the whole behavior

Use the existing repository search and references before editing. Search the error/rule name, shared function, related field names and equivalent checks; exact wording alone misses duplicate implementations.

Trace the behavior through backend/API callers, UI, workers, configuration and relevant tests. Include reachable compatibility and legacy paths. Distinguish historical evidence and signed identity metadata from active enforcement.

Prefer one existing shared rule over separate copies. Update each relevant caller in the same reviewed change. Exercise the behavior through more than one entry point, including a realistic accumulated-history case and applicable security negatives.

Search again after editing. Classify remaining matches as active behavior, intentional compatibility metadata, tests, documentation or immutable history. Record actual omissions and limitations in the existing change plan/checkpoint. Do not claim project-wide completion from one passing route.

This is a working practice, not another approval system or requirement to rebuild unchanged parts. Do not blindly replace every matching word or rewrite historical evidence. Use focused local checks and one appropriate release qualification batch.
