# Public website mobile and laptop review

Status: website redesign published and direct public browser checks passed. Full authenticated Preview regression QA and CodeQL remain queued; this is not a fully green acceptance checkpoint.

Implementation: 4d8ba38322a43c40ed6cd6060ccd6154509c3b9f
Tree: 5d0c2ac4e0716e0a14d2631a25582238d32c353f
Exact Preview: https://my-ai-website-lrn9k3cxp-mohamtaj004bas-projects.vercel.app
Deployment: dpl_EgrrvzPppC893Gs5A5zNnBBRcm9K, READY, target null, matching implementation SHA.
Recorded: 2026-10-05T19:40:23Z.
Branch: feature/callercore-dashboards. PR #5 remains draft, open and unmerged. Main remains 37ef5cfcdccae35952822859f64fe83f0b9f09f0.

## Changes

- Designed dark teal mobile header with orange accent, larger icon-and-label menu control, compact navigation panel, backdrop dismissal, Escape, keyboard focus containment and truthful accessible state. Scrolling retains readable header contrast.
- Compact side-by-side phone hero actions, content-sized example conversation, wrapped industry text, tighter sections, compact capability rows with separators, readable plan features, smaller plan cards, aligned tablet comparisons and a more compact volume calculator and FAQ.
- Replaced the large repeated footer headline and sales panel with a compact brand and useful navigation. Legal, contact, login, demo and pricing links remain. Footer action sits away from the floating assistant at phone and laptop sizes.
- Tightened contact, signup, phone-demo and legal page layouts. Desktop footer and final call to action are also streamlined. Prices, setup fee, Stripe gates, backend functions, dashboard functionality and customer records are unchanged.

## Completed verification

- 1,679 local tests passed, zero failed/skipped. Syntax and whitespace checks passed. Current implementation push CI [37363750056](https://github.com/mohamtaj004ba/my-ai-website/actions/runs/37363750056) and Jekyll [37363754550](https://github.com/mohamtaj004ba/my-ai-website/actions/runs/37363754550) succeeded.
- Direct Chrome browser review of the exact published Preview: 60 public-page layout checks across 320, 390, 430, 768, 1440 and 1920px. All ten routes pass one-main-heading, visible content containment and phone input font-size checks: home, contact, live-demo, get-started, privacy, terms, login, 404, checkout-complete and unsubscribe.
- Real keyboard menu cycling, Escape, pricing anchor dismissal and scrolling-header contrast passed at 320/390/430/768px. Walkthrough advance/playback/reset, keyboard-operable volume calculations (650 then 585 minutes), and FAQ expansion passed. Phone and laptop compositions, compact footer and unobstructed footer action were visually inspected. This is browser emulation, not physical iPhone testing.
- No contact/chat messages, sign-in emails, phone calls or payment sessions were submitted during these direct public checks.

## Outstanding automated acceptance

Authenticated Preview Browser QA [37363750070](https://github.com/mohamtaj004ba/my-ai-website/actions/runs/37363750070), job 111944327778, was still queued at the recorded time. CodeQL push 37363750042 and PR 37363754536, and PR CI 37363754584, were also queued. No completed browser report or screenshot artifact exists for this implementation yet. The expanded public contracts include compact-footer/card limits, no empty demo area or clipped industries, keyboard navigation, and footer/assistant overlap checks.

GitHub reports an Actions degraded-performance incident starting 2026-10-05 at 19:11 UTC: https://www.githubstatus.com/incidents/3q1yb5m7ltvb (status overview https://www.githubstatus.com/). This is consistent with the observed runner queue; it is not evidence of a code failure. Recheck the queued runs and inspect their exact-build report before promoting this implementation to a fully green checkpoint.

The previous fully green checkpoint remains admin mobile implementation 3ebd1c4bf24123bf6290926943d604c1e158b347, authenticated QA 37333161944, documented in docs/admin-mobile-verification.md. Intermediate website previews are superseded candidates, not acceptance records.

Stripe remains paused; actual provider acceptance is still pending. Checkout remains gated. Production/main, real Stripe configuration, tax registrations, telephony activation and production customer data were not changed.
