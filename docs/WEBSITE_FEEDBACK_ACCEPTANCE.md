# October 8 website feedback

## Changes

- Homepage uses the owner's approved combined hero paragraph. “Try it yourself” links to `/live-demo`; the dashboard showcase retains its own sample-screen presentation.
- Homepage introduces the cost of unanswered inquiries in plain language, without unsupported percentages or revenue claims.
- All six industry pages have distinct benefit-led introductions and three visible situations. The large scene selector and animated diagram are removed. Staff responsibilities remain available in disclosures; medical and legal service boundaries remain explicit.
- Repeated “Talk to CallerCore” calls to action become “Talk to us.”
- Pricing cards select their plan across the card, with native link keyboard access and selectable text.
- The shorter planner shows monthly minutes, a prominent recommended starting plan, its reason, and a direct signup link carrying the selection. Starter fits through 300 minutes; Growth through 600. Pro is a higher-volume starting point requiring allowance review, not a claim of unlimited or defined included capacity.
- Demo controls show a separate phone number with explicit copy/call actions. Instructions and the dashboard detour are removed. Existing admission, availability and disclosure gates remain intact; this work does not activate the demo.
- Login is redesigned around the sign-in task, with muted secondary links and inline help. Help requests use the existing saved-inquiry/support inbox and email notification path. Existing sales metadata and marketing consent are preserved. Malformed receipts, delivery warnings, retries and duplicate submission are handled without claiming unverified delivery.

## Local verification

- 1,861 tests passed, zero failures.
- Browser checks passed at 1440, 768, 390 and 320 pixels. All six industries fit; five slider boundary combinations and three plan signup selections were checked at each width.
- Verified native keyboard pricing navigation, admin login context, expired sign-in feedback, email prefill, malformed help receipt, retained help draft, successful acknowledgement and duplicate submission guard.
- Phone reveal UI uses an isolated fixture with explicit number/copy/call controls. No actual phone number was revealed or called.
- Help/sign-in browser requests use isolated API fixtures; endpoint behavioral tests verify saved inbox/notification handling and preservation of sales/consent metadata. No test email was sent.
- Preview credentials are confined to the exact deployment origin; a regression test verifies neither access header reaches external assets or redirected origins.
- Screenshots reviewed for login, planner and industry presentation. Automated layout checks are browser evidence, not physical-device acceptance.

## Hosted verification

- Runtime: `182512c4417b51c258e1e92752704915daa23913`.
- READY immutable Preview: `dpl_596RdJ1poDov3zZ1eCLeK4jMBZvj`, https://my-ai-website-5f6h2dzfy-mohamtaj004bas-projects.vercel.app.
- Stable branch alias is the review surface: https://my-ai-website-git-feature-caller-d75cb2-mohamtaj004bas-projects.vercel.app.
- CallerCore CI PR run 37767563602 passed; Jekyll 37767563682 passed; CodeQL PR run 37767563715 passed with zero SARIF results (job 113278826026).
- Full authenticated Browser QA run 37767555400 passed on the exact immutable deployment. Inspected artifact 11546986811: 279 layout checks, 188 readability checks, 494 screenshot checks and 495 PNGs, including 12 new feedback screenshots. Zero console, page, API or visual failures. All four public-feedback viewport checks passed. Visual comparison step passed.

## Release scope

PR #5 remains draft/unmerged. Production remains the older website release. No live billing, customer phone activation, public demo release, recovery configuration, credential rotation or database restore is included in this change.

Earlier hosted QA 37767068165 stopped at an obsolete assertion for the removed planner chart. The replacement tests reduced motion on the recommendation result; the earlier failure is not acceptance.

The owner’s later request to broaden the audience wording and correct the number/setup line is a follow-up. The approved follow-up is “AI call answering, built around your business” and “Your number or a new one. Setup tailored to your business.” Its new integrated revision awaits its own hosted acceptance.
