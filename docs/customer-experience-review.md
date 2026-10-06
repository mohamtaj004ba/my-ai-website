# Customer experience review — 2026-10-05

Feature Preview only. Production, checkout gates, Stripe environment and email delivery gates are unchanged.

The old receipt page conflated successful payment with delayed workspace fulfillment, stopped polling after about 21 seconds, offered no manual status check, and used repeated payment warnings. It now distinguishes verified paid / account ready / provider processing / unsubmitted / expired / unavailable / missing private link. Confirmed payment cannot regress when the connection or a later status response is delayed. A verified receipt includes the selected plan and actual provider amount; account access appears only after persisted fulfillment.

Confirmation automatically checks with bounded backoff and request timeouts, retains a manual check action after automatic checks stop, and reconnects on an online event. An expired attempt is cleared only when its owner explicitly returns to checkout. An uncertain result never offers a second purchase. No failed charge is invented from a network error.

Visual review covers a dedicated two-column receipt and setup timeline; responsive sign-in confirmation/error cards; signup payment form/loading/error surfaces; private onboarding loading/error/agreement/intake/completion cards; client workspace empty states and cards; billing plan/contact/invoice/payment dialogs; and branded lifecycle emails. Terms, permissions, activation and billing semantics remain intact. Invalid and expired links give a useful route to the team rather than accusing the visitor.

Unit behavior tests cover confirmed-then-offline, unknown provider state, fulfillment gating, explicit expired-checkout recovery and manual status controls. Automated Preview QA adds desktop, 390px and 320px screenshots for six payment states and two sign-in states. These isolated UI fixtures never call Stripe, send customer emails or claim provider acceptance. Actual provider acceptance is documented separately in STRIPE_SANDBOX_ACCEPTANCE.md.
