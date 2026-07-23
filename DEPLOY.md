# CallerCore async onboarding — deployment

Everything in this folder is ready to commit as-is. Files mirror the repo
structure, so you can drop the folder contents over the root of
`mohamtaj004ba/my-ai-website`.

---

## Step 1 — Revoke the token you pasted

Before anything else: **GitHub → Settings → Developer settings → Personal
access tokens → delete the token you shared.** It was sent in plaintext and
should be treated as compromised. Generate a fresh one only if you need it
locally.

---

## Step 2 — Commit these files

| File | New or modified |
|---|---|
| `onboarding.html` | **new** |
| `index.html` | modified — onboarding FAQ answer rewritten for the async flow |
| `get-started.html` | modified — submit handler now creates a lead record and tags the Stripe URL |
| `package.json` | modified — adds `@vercel/kv` and `pdf-lib` |
| `api/lead-create.js` | **new** |
| `api/stripe-webhook.js` | **new** |
| `api/onboarding-data.js` | **new** |
| `api/onboarding-save.js` | **new** |
| `api/onboarding-chat.js` | **new** |
| `api/prefill-crawl.js` | **new** |
| `api/agreement-pdf.js` | **new** |
| `api/_lib/agreement-pdf.js` | **new** |
| `api/_lib/agreement-clauses.js` | **new** |
| `api/_lib/mailgun.js` | **new** |
| `api/_lib/logo-base64.js` | **new** |

Easiest route without a token: on github.com, open the repo, use **Add file →
Upload files**, drag this folder's contents in, and commit to `main`. Vercel
picks it up automatically.

---

## Step 3 — Dashboard setup

These four need your logins and involve secrets, so they're yours to do.

**1. Vercel KV** (stores tokens, lead records, intake progress)
Vercel → your project → Storage → Create Database → KV → connect to the project.
It auto-injects `KV_REST_API_URL` and `KV_REST_API_TOKEN`. Nothing to copy.

**2. Stripe webhook**
Stripe → Developers → Webhooks → Add endpoint
- URL: `https://www.callercore.com/api/stripe-webhook`
- Event: `checkout.session.completed`
- Copy the signing secret (`whsec_...`) → add to Vercel env vars as
  `STRIPE_WEBHOOK_SECRET`

**3. Mailgun**
Confirm you have a sending key for `mail.callercore.com` → add to Vercel env
vars as `MAILGUN_API_KEY`.

**4. GHL webhook URL**
Add to Vercel env vars as `GHL_WEBHOOK_URL`, set to the same webhook-trigger
URL your other site forms already POST to. If you leave this unset, the GHL
push is skipped silently and you'll still get the internal email alert.

Already set, nothing to do: `ANTHROPIC_API_KEY` (reused by the setup-help chat
and the website lookup).

---

## Step 4 — Test the loop with a Stripe test payment

1. Go to `/get-started`, pick a plan, submit the form.
2. Complete checkout with a Stripe test card.
3. Welcome email should arrive with a magic link.
4. Open it — agreement screen loads with your business name, plan, and date.
5. Sign it. A branded PDF should land in your inbox, and the download link
   should work.
6. Start the intake form. Fill a few fields, **close the tab**, reopen the same
   link — it should land you on the first incomplete step with answers intact.
7. Finish and submit. You should get:
   - an email to tj@callercore.com titled "Intake complete — [business]"
   - a POST into GHL with `source: onboarding_intake_complete`

If step 7 fires but GHL shows nothing, check that `GHL_WEBHOOK_URL` is set and
that the workflow trigger is published.

---

## Notes

- The GHL push and the internal email both fire only once, the first time the
  intake becomes complete. Re-saves after that won't duplicate.
- If Mailgun or GHL fail, the intake is still saved and the client still sees
  their confirmation — failures are logged, not surfaced to the client.
- Agreement wording lives in one place, `api/_lib/agreement-clauses.js`, which
  the PDF imports. If you change terms, change them there and mirror the same
  wording in the document markup in `onboarding.html`.
- Still outstanding, not blocking launch: a lawyer's pass over the agreement
  before the first real signature, especially Section 13 (regulated data) if
  you sign a medical or dental client.
