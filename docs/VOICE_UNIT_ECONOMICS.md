# CallerCore Voice Unit Economics — Decision Memo

Updated: 2026-09-21

Status: Planning model only. No billing behavior or public pricing policy is changed by this document.

## Current public plan prices

- Starter: $349/month, 300 included minutes
- Growth: $599/month, 600 included minutes
- Pro: $999/month, positioned as the high-volume plan; public "unlimited minutes" language has been removed pending policy approval

## Current external cost references

The working model uses current public provider pricing as a conservative planning range:

- Vapi platform hosting: $0.05/minute
- Deepgram transcription through Vapi: approximately $0.0095-$0.0099/minute
- OpenAI model usage through Vapi: approximately $0.0077-$0.0452/minute depending model/configuration
- ElevenLabs voice through Vapi: approximately $0.0146-$0.0238/minute
- U.S. local inbound telephony reference: approximately $0.0085/minute
- Stripe standard domestic online card processing reference: 2.9% + $0.30 per successful charge

Those components imply a rough variable voice cost of approximately:

- Low planning case: **$0.0903/minute**
- High planning case: **$0.1374/minute**

This excludes support labor, taxes, Vercel/database, email, phone-number fixed costs, failed-payment costs, refunds/chargebacks, and unusual transfer/call-leg patterns. It is therefore a voice-delivery contribution-cost model, not full company gross margin.

## Base-plan contribution sensitivity

### Starter — 300 minutes at $349

Estimated voice delivery:
- low case: $27.09
- high case: $41.22

Estimated Stripe card fee:
- about $10.42

Revenue after standard Stripe fee:
- about $338.58

Voice cost as a share of sticker price:
- approximately 7.8%-11.8%

This provides substantial room for support/hosting overhead at the included allowance.

### Growth — 600 minutes at $599

Estimated voice delivery:
- low case: $54.18
- high case: $82.44

Estimated Stripe card fee:
- about $17.67

Revenue after standard Stripe fee:
- about $581.33

Voice cost as a share of sticker price:
- approximately 9.0%-13.8%

This also leaves meaningful headroom at the included allowance.

## Pro sensitivity — $999/month

Because Pro no longer promises unlimited usage, the main decision is what high-volume allowance/fair-use level should be included.

Estimated voice delivery by monthly usage:

| Minutes | Low cost | High cost | Voice-only margin before Stripe/overhead |
| ---: | ---: | ---: | ---: |
| 1,000 | $90.30 | $137.40 | 90.9%-86.2% |
| 2,000 | $180.60 | $274.80 | 81.9%-72.5% |
| 3,000 | $270.90 | $412.20 | 72.9%-58.7% |
| 5,000 | $451.50 | $687.00 | 54.8%-31.2% |
| 7,500 | $677.25 | $1,030.50 | 32.2% to negative |
| 10,000 | $903.00 | $1,374.00 | 9.6% to materially negative |

At the conservative high-cost case, an uncapped "unlimited" account can become uneconomic at roughly 7,000+ minutes even before Stripe fees, support labor, infrastructure, and other overhead.

## Overage rate sensitivity

A per-minute customer overage should leave room above the expected variable cost range.

Illustrative contribution before non-voice overhead:

| Customer overage rate | Contribution vs $0.0903 cost | Contribution vs $0.1374 cost |
| ---: | ---: | ---: |
| $0.20/min | $0.1097 | $0.0626 |
| $0.25/min | $0.1597 | $0.1126 |
| $0.30/min | $0.2097 | $0.1626 |
| $0.35/min | $0.2597 | $0.2126 |

The previously mentioned $0.30/min concept remains economically defensible against this current provider range, but it should not be implemented or advertised until the commercial policy is explicitly approved.

## Decision framework

A launch-friendly structure to consider:

### Starter
- 300 included minutes
- usage alerts before the allowance is exhausted
- either:
  - $0.30/min overage, or
  - a hard/soft threshold that requires plan upgrade

### Growth
- 600 included minutes
- usage alerts before the allowance is exhausted
- either:
  - $0.25-$0.30/min overage, or
  - upgrade guidance at sustained higher usage

### Pro
Avoid "unlimited" at launch.

A safer high-volume structure would be one of:
- a defined included allowance such as 2,000-3,000 minutes, then overage;
- a documented fair-use threshold with usage review above it; or
- custom pricing for accounts regularly exceeding the chosen threshold.

## Suggested alert model

Regardless of final overage policy:
- 70%: informational usage notice
- 85%: stronger warning
- 100%: allowance reached
- recurring excess usage: recommend plan review

Alerts should not imply charges will occur until overage billing has actually been approved and implemented.

## What remains unknown

Before locking the commercial policy, measure actual CallerCore production calls for:
- average model cost/minute;
- average voice provider cost/minute;
- average transcription cost/minute;
- average transfer frequency and second-leg telephony cost;
- average call length;
- failed/abandoned-call cost;
- recording/storage cost;
- Vapi success-package choice;
- support labor per account;
- database/hosting cost per account.

The production policy should be revisited after enough real usage exists to compare this planning model with actual unit economics.

## Current recommendation for decision discussion

Do not restore the public "unlimited minutes" claim.

Keep the current Starter/Growth included allowances while the first real usage data is collected. For Pro, use a clearly defined high-volume allowance or fair-use threshold instead of uncapped usage. A $0.25-$0.30/min overage range is economically plausible against current provider pricing, subject to final provider configuration and owner approval.
