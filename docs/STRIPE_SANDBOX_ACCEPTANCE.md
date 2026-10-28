# Stripe sandbox acceptance — 2026-10-05

Native card checkout and billing provider acceptance passed. This does not open production sales. PR #5 remains draft and unmerged.

## Real sandbox results

- Starter checkout: insufficient-funds decline, cancelled 3DS, retry and successful authenticated completion on the same order. A second authenticated order fulfilled. Duplicate creation reused its session.
- Catalog initial totals: Starter $849, Growth $1,099, Pro $1,499, each including one $500 setup line; only the monthly plan recurs.
- Signed checkout webhook created the workspace and captured welcome email. Replay created neither a second workspace nor welcome.
- Real paid-owner login and native billing displayed authoritative plan, renewal, allowance, safe card summary, contact and invoices. Anonymous and cross-workspace access were rejected.
- Cancel at period end, reactivate, Starter → Growth → Pro → Starter, contact update and authenticated payment-method replacement passed. Duplicate confirmations did not repeat provider mutations; stale revisions were rejected.
- A declined upgrade retained Starter entitlements and an open invoice. Native retry paid the same invoice and activated Growth. One failure and one recovery email were captured. Default card was restored to successful test card ending 4242.
- The user-approved disposable Recovery subscription ended. Signed deletion webhook and ended email passed; workspace and invoices remain.
- Replaying an older Pro update after recovery returned HTTP 200 without regressing canonical Growth or its successful card.

Sandbox acct_1To8TZFMvbBcKVZe; Auth sub_1UNQueFMvbBcKVZeCovC39t9; ended sub_1UNQFwFMvbBcKVZeGWL59Yw9; failed/recovered invoice in_1UNRB7FMvbBcKVZeGKlTY5m3. Credentials, private receipts and invoice links are not committed.

## Fixes and verification

Corrected encoded checkout-secret validation, Checkout Elements appearance options, restricted-key mode checks, catalog health aliases, payment-method Save remaining disabled after loading, and failed-upgrade notifications while the existing Stripe subscription remains active. Behavioral tests cover the UI and webhook defects.

Implementation 70a550d28f45189815e9176c95a72af3c2546b5c passed 1,703 local tests, test/build/CodeQL and authenticated Preview Browser QA job 112127970115. Final cleanup must pass the same gates. Responsive proof comes from the automated browser suite; Chrome extension viewport overrides were ineffective and its captures are not phone evidence.

## Cleanup and release boundaries

Temporary Vercel automation access was revoked and independently confirmed absent. Original sandbox webhook URL was restored; existing CI access was preserved. Temporary acceptance endpoint, page, guard and checkout exception were removed. Emails were captured rather than sent externally.

No production deploy, main merge, live Stripe write, tax/overage or telephony activation occurred. Production remains dpl_4d13ERbPnK5gW4cBJjFMDUHNW1wY / 6d36aa454241588140a3d9945eed1a5696a65db6. Checkout stays closed. A production launch requires its public webhook/signing secret, explicit checkout approval, and review of provider email settings to prevent duplicate notifications. Restored sandbox Preview is protected, so remaining test events may retry without acceptance access. Non-card asynchronous methods and a physical phone were not exercised.
