# Industry pages: second design and product pass

October 10, 2026. Preview only; builds on the accepted first pass in `INDUSTRY_REDESIGN_ACCEPTANCE.md`.

## Revision and release

- Industry implementation SHA: `e362974ab7cfe1cca5a6c88c7843c3c16cd3464f`.
- Final integrated verification SHA (capture corrections): `9efaf3f46752dfd8145ed17b4f4db334be580c71`. Concurrent feature work at `7fde017e` was fast-forwarded and preserved; this industry acceptance does not establish acceptance of its real-call behavior.
- Branch: `feature/callercore-dashboards`; PR #5 remains draft/unmerged.
- Immutable Preview: https://my-ai-website-l87v7ggvl-mohamtaj004bas-projects.vercel.app.
- Deployment: `dpl_8MW6f9ySvKVKBnxiK4D7yyk3sc2L`.
- Hosted acceptance: **passed**, including final CI, Jekyll, CodeQL and full authenticated Browser QA. Superseded run 38110970490 found an empty-placeholder screenshot decode; the source-image filter and instant-scroll capture corrections are included in the accepted revision.
- Main and Production are outside this release. No telephony, provider, billing or customer activation changes.

## Page-by-page design and buyer conviction

| Page | Distinct narrative and visual device | Concrete result and proof |
| --- | --- | --- |
| Home Services | Working-day timeline with three recognizable interruptions, followed by four selectable call-to-work scenarios. Large times, restrained timeline emphasis and a sage closing inset. | Project/location/timing and estimate callbacks become reviewable requests. Follow Ups dashboard sample shows where work is reviewed. Breadth includes indoor projects, outdoor work and ongoing care. |
| Automotive | Service-desk pressure scene with a vertical queue selecting service visits, vehicle-status callbacks or service questions. Dark prepared handoff contrasts with the desk queue. | Vehicle context, requested timing and callback details; advisors confirm availability, diagnosis, authorization and price. Calls dashboard sample. Status callbacks explicitly do not promise live repair-status lookup. |
| Professional Services | Three narrowing steps move from vague need through context to a prepared brief. Paper treatment and offset composition give the brief visual priority. | Service interest, timing and initial background prepare a conversation; the firm decides fit and next steps. Contacts dashboard sample. Consulting, accounting, creative and other professional teams are included naturally. |
| Property | Four caller types feed a visible connecting request path. Selecting a branch highlights its connection and changes the review context. Two-column merge on phones, four-way merge on desktop. | Prospect/resident/owner/vendor context prepares staff review. Follow Ups dashboard sample. Live transfers use the configured destination and hours; this is not automatic multi-team dispatch or ticket creation. |
| Legal | A first-contact / firm-review threshold leads into three selectable intake examples. A quiet contact brief and restrained rule-based close retain a considered tone. | General contact requests prepare firm review without advice, conflict checks, acceptance of matters or establishment of a relationship. Calls dashboard sample. |
| Medical | Three practical office-call choices appear before the visit journey; this makes useful operational behavior visible before the service boundary. Calm paper output and a compact office/care split. | Approved office information, administrative callbacks and qualified-staff handoff. Calls dashboard sample is expressly a general workspace example, not a medical record or protected-health workflow. |

Each page preserves its photographic hero while improving image crops, readable captions, type scale, section rhythm and final action. Compact subcategory text communicates breadth without repeated pills or an SEO list wall. Pressure comes from recognizable competing demands and the consequence of losing context; no invented ROI, savings or missed-call statistics were added.

## Product truth and control

The copy was checked against `lib/voice-tools.js`, `lib/voice-policy.js`, `lib/voice-service.js` and `lib/voice-store.js`. Requests become canonical call/contact/follow-up records. The current transfer policy uses a configured destination and hours. Live status lookup and external property/ticket integrations require separately supported integration; the pages do not imply those are active capabilities.

One existing dashboard sample asset appears on each page and opens a native enlarged image dialog. Samples are clearly labelled example data. Illustrative call flows are also labelled. No live customer content, public telephone numbers, audio simulations, emergency-dispatch promises, autonomous bookings, HIPAA claims or clinical capabilities were introduced. Medical and legal final boundaries remain explicit.

Demo actions link to the existing `/live-demo` page. Appropriate industry-specific consultation actions link to `/contact`. The public demo configuration was not changed or activated.

## Accessibility, interaction and responsive review

- Eight widths: 1920, 1440, 1280, 1024, 768, 430, 390 and 320px; all six routes, 48 combinations.
- Checked rendered layouts, image crops, headings, section hierarchy, inline product proof and final actions; proactively fixed an inherited automotive flex-layout collision, awkward isolated heading words, pale paper labels and narrow-screen compositions.
- Local browser matrix passed all 48 combinations: IDs, anchors, body text size, overflow, responsive navigation, all selectable states, selected-state contrast, touch targets, final CTA navigation and script errors.
- Image viewer: keyboard opening, close/Escape, focus restoration, decoded full-resolution sample and restored page scrolling. The close-event check waits for the browser event rather than reading a transient pre-event value.
- JavaScript-disabled examples remain fully readable on every page and proof links still open the source image. No content depends on animation or viewport observation.
- Reduced motion disables transitions/animations. Shared browser verification additionally exercises every new selector under reduced motion.
- Motion is limited to selected-path/result feedback and subtle timeline emphasis. No autoplay or cycling examples.
- Screenshot generation returns instantly to the top (avoiding a smooth-scroll capture) and decodes lazy images after history navigation to avoid empty proof images in full-page evidence; separate rendered proof/hero/closing captures were manually inspected at 1440, 390 and 320px.
- Contrast assertions cover the tested text against solid backgrounds; they are not a comprehensive accessibility certification.

## Validation

- Local complete test suite: **1,875 passed, zero failures** on the industry implementation; **1,877 passed, zero failures** on the integrated final verification revision.
- Internal links: every local destination referenced by the six pages resolves; no broken paths found.
- Targeted industry tests: **3 passed**, including existing sample asset references and accurate status/transfer/regulated boundaries.
- Existing public-flow browser suite passed at 1440, 768, 390 and 320px: plan selection/signup destinations, five planner boundaries, login-help malformed receipt/retry/success/duplicate guards, fixture demo reveal/copy actions and all industry routes.
- Public-flow tests use isolated fixtures: no messages, payments or telephone calls were placed.
- Final-revision CI 38111472286 / PR 38111474944 and Jekyll 38111474924 passed. CodeQL 38111472267 / job 114387768898 passed with total SARIF results zero. Full authenticated Browser QA **38111472262 / job 114387816995 passed**. Artifact **11691817377** downloaded and inspected: `ok:true`, pinned immutable URL, **48 industry combinations / 48 industry screenshots**, all selector states, no-script and reduced-motion checks passed. Broader evidence: **279 layout contracts, 188 readability contracts, 494 screenshot checks, 543 PNGs**; zero console/page/API/visual failures. All six dashboard comparisons were `ok`, severe drift false. Hosted industry body/proof screenshots were visually inspected after download.

This redesign does not upgrade voice acceptance, medical suitability, billing or customer readiness. Existing canonical release gates remain in force.

Production was rechecked unchanged at `6d36aa454241588140a3d9945eed1a5696a65db6`, deployment `dpl_4d13ERbPnK5gW4cBJjFMDUHNW1wY`. Main remains `37ef5cfcdccae35952822859f64fe83f0b9f09f0`. No merge or Production deploy was performed for this pass.
