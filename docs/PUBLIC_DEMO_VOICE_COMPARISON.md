# Existing public demo voice comparison — October 8

TJ requested a read-only review of a separate existing Vapi assistant, Public Demo | CallerCore, after calling it at approximately 05:39 Pacific. This is assistant `bdbb8500-1bc6-4aa2-9a07-a13304074886`, version v1. It is NOT the isolated CallerCore demo workspace/assistant previously accepted through the application. No configuration, credentials, routing or public website exposure were changed by this review.

The call lasted about 168 seconds and cost $0.27 in the provider display. Owner reported substantially more natural conversation, with some remaining issues. Transcript shows adapted fictional business role-play, conversational intake, and native EndCall around +166.94 seconds. It switched industries when asked. This is owner-reported quality and provider transcript evidence, not CallerCore integration/customer acceptance.

| Setting | Existing public demo | Internal GPT-Live baseline (before comparison) |
| --- | --- | --- |
| Conversation architecture | Classic transcriber → text model → synthesized voice | GPT-Live speaker + separate reasoner |
| Model | OpenAI GPT-4.1 Mini | GPT-Live with GPT-5.6 Terra reasoner, low effort |
| Transcriber | Deepgram Flux General English | GPT-Live conversation; classic selector does not configure it |
| Voice | Vapi Elliot v2 | OpenAI Marin, unhurried personality guidance |
| Start-speaking wait | 0.1 seconds; punctuation 0.1, no punctuation 1.5, number 0.5 | Classic speaking-plan controls do not configure GPT-Live |
| Stop-speaking plan | 0 words, 0.2 voice seconds, 0.6-second backoff | No corresponding classic-plan control in GPT-Live |
| Silence/duration | 26-second silence timeout; 600-second maximum | Current saved bounded policy; no equivalent silence acceptance inferred |
| Tools | No attached custom tools; legacy end-call function enabled | Authenticated, workspace-bound CallerCore facts/save/transfer/result tools and native endCall |
| Prompt | Editor shows 1,544 tokens; warm, personable, casual role-play; one question at a time | Simplified factual receptionist speaker plus detailed reasoner/server safeguards |

The public demo's prompt is not especially short. It emphasizes warmth, varied language, natural reactions and one question at a time. Its fictional role-play promises that someone will follow up; no CallerCore save action occurred in this reviewed conversation. Do not transplant those claims as real commitments or infer validated CRM/usage integration from the performance.

The differing engine/voice/turn-detection pipeline is a plausible contributor to the naturalness difference, not an isolated causal proof. Vapi confirms that classic transcriber/TTS/start-and-stop speaking plans do not configure GPT-Live: https://docs.vapi.ai/gpt-live/configuration. Copying the demo's stop-speaking numbers into the current GPT-Live configuration would not create that behavior.

Recommended next test: compare the demo's classic voice pipeline on the existing isolated internal line while retaining CallerCore authentication, ownership/revision checks, canonical idempotency, real tool results, disclosure, recording-off, bounded duration and release gates. Keep the public reference assistant unchanged. This recommendation is not authorization for customer telephony, public demo publication or additional spending. TJ explicitly authorized: Test the demo’s voice pipeline internally. The controlled internal-only implementation is prepared with 1,873 local tests passing; hosted publication/read-back and actual telephone acceptance remain pending. The comparison retains real CallerCore actions rather than fictional follow-up promises.


## Controlled internal comparison, October 8

Owner authorized the classic pipeline on the existing internal assistant only. Published application 474761199c21316b1c0e6a977fb4c2fad16b3b98: READY dpl_9N4Qt1gotQx94eSDun6itTSMNFCW, https://my-ai-website-zcyg9lv93-mohamtaj004bas-projects.vercel.app. CI 37783938231 / PR 37783955473, CodeQL 37783938166 / PR 37783955276 (job 113333749101: zero SARIF), Jekyll 37783955371 passed. 1,873 tests. Full authenticated Browser QA 37783938274 / job 113334441122 passed; artifact 11553223980 downloaded and inspected: exact Preview/SHA, 279 layouts, 188 readability, 494 screenshot checks, 531 PNGs, zero console/page/API/visual failures, six non-severe comparisons. Browser voice/billing are seeded.

Initial provider sync saved v21 but failed closed on numeric-versus-string Elliot version. Safe diagnostics proved version returned as string 2; exact equivalent normalization fixed this without weakening other read-back checks. Internal verification recovered ready state with exact model, recognition, voice, tools, callback authentication and routing checked. No second blind provider write.

REAL owner call 01a11bb3-06fa-7338-baa7-3672e7c1f60b at 06:28 Pacific used v21. Provider displayed 1m55s/$0.14; canonical verified duration 116 seconds. Owner: sounded natural in some ways and hung up, but repeated goodbye. Transcript shows corrected issue retained, one question at a time, but originating-number save FAILED. Actual save arguments used callbackNumber:null; strict argument validation returned VOICE_TOOL_ARGUMENTS_INVALID. The assistant incorrectly asked the caller for E.164 formatting and reopened abandoned intake during closing. Native endCall executed; owner confirms disconnection. Immediate interruption/current-hours/relative-date acceptance not confirmed in this test.

Private export validates 22 canonical calls/journals/usage entries, 2,159 connected seconds, zero pending. Latest call has exactly one 116-second usage entry, no saved request and no successful tool-mutation journal. Provider UI “Completed successfully” labels mean transport completion, not a confirmed CallerCore action. Raw contact/address/provider logs remain private.

Prepared follow-up: normalize known optional null tool fields to omission (required consent/intent/reason and unknown keys still fail); use the verified originating number when callback is omitted; no technical-format request to caller. Classic-only tool start messages suppress lookup fillers and supply one blocking goodbye through endCall; conversational prompt does not add a second goodbye or reopen abandoned intake, and records an unsaved abandoned request as incomplete. Local 1,874 tests pass. Needs publication, internal sync/read-back, exact full hosted QA and fresh request-save/closing acceptance. No public reference or isolated app demo setting changed.

