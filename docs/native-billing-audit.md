# Native billing audit — 2026-10-05

CallerCore owns the signup and ordinary client billing experience. Stripe owns sensitive payment collection and authoritative financial records. Native billing uses canonical tenant-bound provider lookups, allowlisted prices, explicit confirmations, revisions, locks, stable idempotency and durable audits/outbox records. Payment updates use owned SetupIntents; pending invoice authentication uses only an owned invoice secret. Signup checks provider-paid state, exact line items, saved terms and durable managed onboarding. No raw card/CVC/full bank fields reach CallerCore.

Verified UI/backend implementation: **6cb55b9e39b6d83d40636e7d8e664543dda7d673**, tree 4aa2de828e170990e003fc688670aab14b741876. **1,675 local tests pass**; exact candidate CI/CodeQL/authenticated responsive Preview QA pass. Browser billing fixtures are explicitly not real Stripe acceptance. Sandbox keys and test price IDs are absent from inspected branch-specific environment metadata; no secret values were read. Provider-complete billing E2E remains pending. Public checkout, including Preview, stays closed. New live billing writes and live billing emails remain closed.

## Read-only live catalog

| Product | Canonical price | Amount |
|---|---|---|
| Starter | price_1To98LF0BXlPng7V4YXh69Yc | $349/month |
| Growth | price_1To9D3F0BXlPng7VH3Ye2OzZ | $599/month |
| Pro | price_1To9G4F0BXlPng7VkvMGPE2Y | $999/month |
| Setup | price_1To9HhF0BXlPng7V0OBFPmQR | $500 once |
| Overage | price_1To9SUF0BXlPng7VMlDTJE8P | $0.30/minute; not attached |

Account: CallerCore LLC, acct_1To8TMF0BXlPng7V. Existing canonical references match; none was silently switched. The enabled webhook https://www.callercore.com/api/stripe-webhook covers checkout complete/async success, subscription created/updated/deleted and invoice paid/failed. Webhook API version: 2026-06-24.dahlia; new client API version: 2026-08-26.dahlia. Active default portal supports invoices, payment/contact updates and period-end cancellation; retained as fallback. The $0 Test - Do Not Sell price price_1TwVZWF0BXlPng7V5AihG4Sz is untouched.

## Signed-in email settings: inspected, unchanged

Business customer emails: successful-payment and refund receipts off. Canada PAD, ACH, Australia BECS and Bacs notices on. New Zealand BECS and SEPA notices required/on. Pix receipts on; Pix completion reminders and Multibanco/bank-transfer instruction emails off. Sending domain stripe.com; reply address tj@callercore.com.

Subscription emails: trial reminders, renewal reminders, expiring cards, failed card/bank payments and hosted authentication links off. Finalized invoices and credit notes on; unpaid recurring reminders off. Read directly from the signed-in Dashboard; no switches or Save controls used.

CallerCore owns branded purchase/welcome, activation, plan changes, payment/contact updates, failed/recovered payments, scheduled cancellation/reactivation/end and paid invoice summaries. Initial purchase owns the initial payment receipt, avoiding a second initial-invoice email. Renewal summaries deduplicate by invoice identity. Official invoice documents remain Stripe-generated. Review finalized-invoice notices for overlap before release. Retain credit notes and required bank/issuer notices unless separately authorized. CallerCore live email activation requires acceptance of proven equivalents and ownership; Preview captures without transmissions. Sending/uncertain outbox records require reconciliation, never blind resend.

## Remaining release acceptance

Exact Preview https://my-ai-website-gjn1c7fsl-mohamtaj004bas-projects.vercel.app, dpl_2FR4p4mar4u7axSXJyi3Mmar5CLa is READY, SHA matched, target null. CI 37295563659/37295568403, CodeQL 37295563649/37295568377, Jekyll 37295568297 and authenticated QA 37295563490 pass. Artifact 11339530935: 230 layout, 150 readability, 55 public contracts, 352 screenshots; zero console/page/API/visual failures. Laptop/tablet/phone billing and keyboard screenshots inspected. Report explicitly marks billing uiFixture:true/providerComplete:false. Live isolated GPT regression saves were restored.

Real isolated sandbox payment, decline, 3DS, asynchronous payment and persistence recovery must pass before provider-complete is verified. Use a controlled test harness; do not open public checkout. Tax/business registration remains owner action based on TJ's supplied evidence; support delivery is verified based on TJ's supplied independent inbound/outbound/generated-mail evidence. No production/customer-data/live Stripe/email settings changes, tax registrations, overage charges or voice activation. PR #5 remains draft/unmerged.

API compatibility references: [Checkout Session creation](https://docs.stripe.com/api/checkout/sessions/create) documents ui_mode elements, return_url and integration_identifier; [custom Checkout quickstart](https://docs.stripe.com/checkout/custom/quickstart) documents the versioned Stripe.js SDK. Documentation verification is not a successful provider transaction.
