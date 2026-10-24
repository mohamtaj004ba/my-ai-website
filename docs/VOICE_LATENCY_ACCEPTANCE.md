# Isolated voice latency acceptance — October 8

Status: failed owner acceptance. Preview only; no customer activation.

The existing internal assistant uses GPT-Live v18. Pace and physical disconnection passed only the owner's short 04:28 Pacific test; immediate interruption remained too slow. Later broader conversation tests have not passed.

At 04:56 Pacific, call `01a11b5f-1c1e-777f-affc-61ca349f714a` answered current hours correctly. Owner reported a pause. Context was submitted with `validAcrossCall:true`, `open:false`; its submission time relative to the question was not recorded. The transcript shows question start +12s, delegation and “Hmm” +14s, hours tool +14.2s, answer start +17.6s.

Follow-up `df88bb2f6fee4ae5c694855c393dda0c790cec3b` removes a separate context-control wait from synchronous fact-tool handling. Lifecycle context submission remains once-only. The hours tool now supplies verified current state and whether it remains valid across the bounded call. Ownership, authorization, revision checks and idempotent business mutations remain intact.

At 05:08 Pacific, call `01a11b6a-51d7-7dd0-a2a2-a462fde270b4` still FAILED: owner reported longer delay and poor answers to additional questions. Canonical duration 93 seconds, provider cost $0.16. Hours answer was correctly closed, but question start +12.8s to answer start +19.8s included delegation, another “Hmm”, and the hours lookup. A separate context attempt timed out and was not retried. It did not hold up the fact tool in the follow-up implementation.

For tomorrow's appointment availability, the assistant correctly disclosed that it cannot see a calendar, but did not offer to capture an appointment request. After the caller commented on silence at +45.8s, its response began at +66.8s, with no business-tool delegation in that interval. These are transcript start timestamps, not an exact acoustic measurement from the end of caller speech. Backend tool simplification alone did not resolve conversational latency. The provider recorded an endCall action; the owner has not separately confirmed physical disconnection on this latest test.

The private export validates: 19 canonical calls, zero pending recovery, one 93-second usage entry for this call and no additional FAQ lead. Raw transcripts, caller details, credentials and transport URLs are not included here.

TJ chose to investigate the over-prescriptive prompt before changing engines: the assistant should converse like a capable receptionist, rather than follow many small rules. The speaker prompt has therefore been simplified around understanding, answering and offering useful next steps. Detailed tool authorization, normalization and result handling remain in the reasoner/server. GPT-Live, restricted credentials, internal routing, disclosure, recording-off and release gates are preserved. This is a hypothesis requiring a fresh owner call, not proof that prompt complexity caused the long delay or that interruption timing is fixed.

Next acceptance: current hours, a routine business question, an appointment availability question with a useful request-capture offer, interruption, and explicit goodbye on the internal line. If the simplified prompt still fails, revisit a controlled engine comparison or provider-level resolution. Any telephone test must remain inside the previously authorized $8 TOTAL working call budget. No additional purchases are authorized by this document.

## Simplified prompt retest

Prompt revision `14f9f76d7bc94cf81a1cb862a95ce7898287e4b7` was synced to the existing internal assistant only, with complete provider/routing read-back around 05:28 Pacific. Speaker fixture text decreased from 1,105 to 397 words (62% fewer characters); reasoner/server safeguards remain. Demo assistant and Production unchanged.

Actual v19 call `01a11b7d-4e92-7dd0-a35d-7677d543d56d` at 05:29 Pacific lasted 197 canonical seconds, provider $0.34. It offered to capture the inspection request instead of only refusing calendar access. Corrected details were saved once and the result truthfully marked as a request, without confirming availability. This is observed tool/conversation behavior, not owner naturalness acceptance. Unnecessary checking narration and interpretation mistakes persisted. The owner only replied “called”; a separate qualitative verdict is pending.

Hangup FAILED: after recording the request earlier in the call, the speaker said goodbye repeatedly but made no further delegation/endCall. The caller explicitly stated they would hang up; provider ended reason Customer. Canonical export validates 20 calls, zero pending and exactly one 197-second usage entry for this call; no additional lead. Context timed out without retry. No spoken current-hours or immediate-interruption acceptance inferred from this test.

Follow-up preserves the concise prompt but makes the required platform action explicit: delegate endCall after an explicit goodbye even when complete_call already recorded the result. Also answer supplied facts directly without needless delegation, and explain unavailable calendar access without promising to check it. These are capability/transport boundaries, not a return to a scripted intake. Local suite remains 1,871 passed and 82 focused voice tests passed. Published at 48763fba28b28dd2710137f3b9d9b4f0430479bc, included unchanged in fully accepted combined 9f6fc9fec940d610569adda546e56b073622877a, and internally synced around 05:54 Pacific with read-back. No actual owner ending acceptance of this revision; subsequent owner-authorized classic pipeline comparison supersedes another GPT-Live-only retest.

TJ made an additional v19 call at 05:34 Pacific, `01a11b81-fe8a-7338-b7fc-456aff2e828e`, 83 canonical seconds. Owner reported improvement in some ways, but insufficiently firm responses: tomorrow-hours answer recited the weekly schedule before saying yes. Transcript confirms direct service-area response, honest uncertainty for an unlisted area with a useful capture offer, and continued fillers/delegation. No explicit goodbye in this test, so no new ending acceptance/failure inferred. The follow-up adds a general answer-first principle using verified facts and verified localDate for relative dates. Export validates 21 canonical calls/usage entries, 2,043 seconds, zero pending and no additional FAQ lead. Immediate acoustic interruption and overall naturalness still unaccepted.



