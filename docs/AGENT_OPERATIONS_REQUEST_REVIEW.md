# Agent Operations outbound request review — October 11

The second pilot's confirmed result is HTTP 400 / invalid_request_error, request req_cfffba50255748cb820fb2db88e9f3bf. Its offending parameter and provider message were discarded. The exact historical root cause remains unconfirmed. No live API request was made during this review.

The client is Node native fetch. There is no OpenAI SDK, AI SDK, gateway, middleware or default parameter injection on this execution path. A deterministic POST body is serialized in lib/agent-operations-pilot.js.

| Field | Reviewed outbound value / compatibility |
|---|---|
| Endpoint/method | POST https://api.openai.com/v1/responses |
| Authentication | Dedicated project key; fixed project/organization headers; correlation header; JSON content type; redirects rejected |
| model | gpt-4.1-2025-04-14, supports Responses and structured output |
| instructions | Stage-specific string with explicit JSON directive and untrusted-data boundary |
| input | Originally one user message with input_text containing serialized objective/scope/prior; Chief has no images |
| specialist/reviewer images | Four bounded PNG data URLs as input_image with detail=low |
| max_output_tokens | 1500, within model capacity |
| store | false |
| tools | Empty array; no function schemas, hosted tools or tool-choice override |
| text.format | type=json_object, the Responses JSON-mode field |
| metadata | task_id/execution_id strings, within documented count/key/value bounds |
| absent fields | No reasoning/effort, Chat Completions response_format/messages/max_tokens, temperature, background, streaming, previous response or retry settings |

The [Responses reference](https://developers.openai.com/api/reference/python/resources/responses/methods/create) documents these field types and defines instructions as a system/developer message inserted into context. The [GPT-4.1 model page](https://developers.openai.com/api/docs/models/gpt-4.1) confirms snapshot, endpoint, image input and structured-output support. No documented incompatible parameter was identified.

The [Structured Outputs guide](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses) requires explicit JSON guidance in context. The historical input text did not contain JSON, while top-level instructions did. Therefore an input-only JSON prerequisite is a hypothesis about stricter provider validation, not a proven contract violation or established historical cause. The correction adds one fixed developer input_text message containing JSON; stage instructions, objective data, scope, tools, credentials and budgets remain unchanged. The offline input-only mock deliberately demonstrates that hypothesis and is not a provider emulator or evidence of the historical implementation.

Diagnostics now preserve allowlisted error codes, known parameter names/bounded input indices and fixed canonical summaries derived from provider errors. Unknown/raw text is omitted. Arbitrary messages can contain credentials or echoed prompts, so they are never copied. Both the adapter checkpoint and store/IPC sanitizer preserve only the safe fields; request IDs, status, type, timing and usage behavior remain. Unsupported parameter/value/type, missing parameter, JSON-context, authentication, model/access, quota/rate and provider errors have safe summaries. Unknown names/codes/text fail closed. No raw body/header, secret, sensitive payload or exception message is persisted.

Offline verification captures the actual adapter request, checks all body/header keys, roles/content types, endpoint, model, metadata bounds and response format. It demonstrates a legacy-shaped rejection under the explicitly hypothetical input-only gate, and corrected Chief delegation with a synthetic response. Separate tests verify 400 error checkpoints, no retry/refund, secret echo suppression and actual restricted-child IPC preservation of the new fields. Independent review found no material security or accounting blocker.

The original $0.30 plus second $0.30 remain pending ($0.60 total). No accounting state was reset or released. Paid execution remains disabled. Readiness is limited to an independently reviewed request/diagnostic path for a separately authorized diagnostic experiment after final Preview checks; successful live inference and the historical rejection's precise cause remain unverified. No new pilot is authorized by this investigation.
