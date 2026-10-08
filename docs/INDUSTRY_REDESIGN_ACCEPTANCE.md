# Industry redesign — October 8, 2026

## Scope and composition

All six existing industry routes are redesigned below their photographic heroes. Header, navigation, footer, imagery, contact destinations and regulated-service limits are retained. Home Services uses the owner's requested hero headline and broader project/ongoing-care examples. No new hospitality category was invented.

| Route | Story | Distinct visual device |
| --- | --- | --- |
| Home Services | A workday of calls, becoming organized work | Large timestamp timeline, call-to-work record, four selectable scenarios |
| Professional Services | A first inquiry becoming a prepared conversation | Narrowing inquiry funnel and an illustrative client brief |
| Medical | The experience before an appointment | Connected pre-visit journey, office/care boundary and evening request |
| Automotive | Incoming calls beside a busy counter | Service-desk queue and collection/confirmation handoff |
| Property | One request finding the appropriate next step | Connected routing path and staggered destinations |
| Legal | An inquiry arriving before the firm's review | Intake threshold, contact-request letter and quiet-work composition |

The repeated equal cards and settings grids are removed. Business decisions, expert advice, confirmed appointments, prices, dispatch and legal/medical assessments remain with the appropriate humans. Illustrative records are marked as examples. Status answers require an available supported source; absent one, the message becomes a request. No statistics or ROI guarantees are introduced.

## Local evidence

- 1,871 tests passed with zero failures/skips after integration with shared branch `48763fba`.
- All six routes passed browser checks at 1440, 1024, 768, 430, 390 and 320 pixels: 36 route/viewport combinations and screenshots.
- Verified no horizontal overflow, unique IDs, valid fragment targets, one H1, readable body text, lower-section text contrast, hero contact links, closing CTA destinations and responsive menu behavior.
- Home Services: all four scenario choices, one visible result, native keyboard activation, four concise flow steps, reduced-motion behavior and all four readable results with JavaScript disabled.
- Existing public-flow browser checks passed at 1440, 768, 390 and 320: pricing, plan carry-through, login/inline help, demo fixture and all six industry destinations. No actual email, payment or telephone call was sent by these checks.
- Desktop and phone screenshots visually reviewed. Local artifacts are in `work/industry-qa` outside the tracked repository. Contrast checks cover solid-background narrative text; they are not a claim of a comprehensive accessibility certification or physical-device acceptance.
- Preview QA now runs the industry checks against its exact immutable deployment. Both Preview credentials are restricted to that deployment origin, including no-script and reduced-motion checks.

## Published candidate

- Application revision: `9f6fc9fec940d610569adda546e56b073622877a`.
- Immutable deployment: `dpl_9gJzzsmX1e63nis1e9bvbZhYSQm7`, https://my-ai-website-5xunecjie-mohamtaj004bas-projects.vercel.app.
- Deployment is READY. All six hosted pages were independently fetched and confirmed to contain their distinct story device and preserved hero photograph.
- CallerCore CI PR run `37779478844`, Jekyll `37779478882` and CodeQL `37779479045` passed. CodeQL job `113318645188` reports zero SARIF findings.
- Full authenticated Browser QA `37779468857`, job `113319037955`, passed on the immutable deployment. Downloaded and inspected artifact `11551927045`, ZIP SHA-256 `e8e6ea412eaaa70f0a8eabdb04081a313647dd6d29fd4cd939dfd6e43f42c6d8`.
- Report is successful: all 36 industry route/viewport checks passed, along with no-script and reduced-motion scenarios and all four existing public-feedback flow sets. The broader suite recorded 279 layout checks, 188 readability checks, 494 screenshot checks and 531 PNGs including 36 industry screenshots. Zero console, page, API or visual failures.
- All six existing client/admin visual-baseline comparisons were `ok`; no severe drift. The industry redesign is intentionally new and is visually reviewed against its own screenshots, not claimed unchanged from the previous industry design.

## Release boundary

Work remains on `feature/callercore-dashboards`; PR #5 stays draft/unmerged. Main and Production are not changed by this redesign. Production's last verified revision is `6d36aa454241588140a3d9945eed1a5696a65db6`, deployment `dpl_4d13ERbPnK5gW4cBJjFMDUHNW1wY`. No live billing, customer activation, public demo release, provider configuration or voice acceptance is included.
