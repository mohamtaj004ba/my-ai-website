# CallerCore Analytics Rollup Design

Status: Approved design for implementation before raw analytics expiration is enforced.

## Goal

Preserve long-term business intelligence while allowing raw identifiable analytics to expire.

## Permanent rollup key

`analytics:monthly:YYYY-MM`

Each record should contain only aggregate or anonymized metrics.

## Suggested monthly fields

### Website / acquisition
- visitors
- sessions
- pageViews
- contactSubmits
- checkoutStarts
- checkoutCompletes
- conversionRate
- sourceCounts
- utmSourceCounts
- utmCampaignCounts
- planInterestCounts

### Sales / customers
- newCustomers
- activeCustomers
- cancellations
- churnRate
- planMix
- mrr
- arrRunRate
- setupRevenue
- recoveredPayments
- failedPayments

### Voice / operations
- totalCalls
- answeredCalls
- missedCalls
- transferredCalls
- transferRate
- totalMinutes
- averageCallDuration
- leadsCaptured
- appointmentsBooked
- appointmentRate
- voicemailCount
- escalationCount
- aiContainmentRate

### Support / reliability
- supportTickets
- averageResolutionTime
- providerErrors
- webhookFailures
- authenticationFailures
- productionIncidents

## Privacy rules

Permanent rollups MUST NOT include:
- visitor IDs
- session IDs
- phone numbers
- email addresses
- names
- IP addresses
- exact addresses
- message bodies
- call recordings
- call transcripts
- individual appointment details
- raw provider payloads

Small cohorts should be suppressed or merged when necessary to reduce re-identification risk.

## Build sequence

1. Create a monthly accumulator helper.
2. Update website events, checkout, billing and future voice ingestion to increment aggregate counters.
3. Add an admin analytics endpoint that reads current and historical monthly snapshots.
4. Add year-over-year and month-over-month comparisons in the admin dashboard.
5. Verify rollups against raw data for at least one full month.
6. Only then enable 180-day raw site-event expiration.
7. Add a monthly integrity check to detect missing or obviously inconsistent rollups.

## Recovery

Monthly rollups should be included in workspace/platform backup exports where appropriate and should be reconstructable from provider/accounting sources for recent periods if corruption is detected.
