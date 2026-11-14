# CallerCore

CallerCore is a managed AI communications platform for service businesses. The current product combines a public acquisition site, Smart Onboarding, a client portal, and an internal operations dashboard around an AI receptionist workflow.

## Product surfaces

### Public site
- Marketing / pricing
- Live AI demo
- Contact and chatbot inquiries
- Get Started / Stripe checkout
- First-party funnel analytics
- Privacy / Terms

### Client portal
- Overview / launch status
- Calls
- Conversations
- Leads
- Appointments
- AI Agent
- Phone & Routing
- Locations
- Automations
- Analytics
- Integrations
- Billing & Plan
- Settings
- Help & Support
- Workspace data export

### Admin operations
- Command Center
- Clients
- AI Agents
- Calls
- Leads
- Unified Inbox / Gmail
- Automations
- Website analytics / prospects
- Revenue / Usage
- Provisioning
- Phone Numbers
- Support
- System Health
- Platform Settings

## Architecture

CallerCore is currently a static HTML/CSS/JavaScript application hosted on Vercel with Vercel Functions for backend APIs.

Core services/modules live under:
- `api/` — HTTP endpoints / Vercel Functions
- `lib/` — shared application services
- `tests/` — automated critical-path tests
- `docs/` — release/readiness and owner-decision documents

Persistence currently uses Vercel KV / Upstash.

## Current integrations

Implemented or substantially implemented:
- Stripe checkout / subscription lifecycle handling
- Mailgun lifecycle email
- Google Gmail OAuth / unified inbox
- Anthropic-assisted Smart Onboarding extraction/configuration
- Vercel / Upstash persistence and deployment

Voice / Vapi remains a dedicated production-core implementation area.

## Development

Install dependencies:

```bash
npm ci
```

Run tests:

```bash
npm test
```

The Vercel build also runs the critical-path test suite.

## Branches

- `main` — production
- `feature/callercore-dashboards` — current major product-development branch

Do not merge the feature branch into production casually. It represents a substantial product release.

## Project continuity

Read `CALLERCORE_PROJECT_STATE.md` for the latest verified checkpoint, active work, and production restrictions.

## Release documentation

Read these before any production launch:

- `DEPLOY.md`
- `docs/PRODUCTION_READINESS.md`
- `docs/TJ_DECISION_BACKLOG.md`

## Commercial terms

Current published plans are:

- Starter — $349/month — 300 minutes — 1 location
- Growth — $599/month — 600 minutes — up to 2 locations
- Pro — $999/month — high-volume plan; usage allowance/fair-use policy pending approval — up to 5 locations
- Professional setup — $500 one time

Pricing should not be changed in code or copy without an explicit business decision.

## Security

The repository must never contain production secrets. Use environment variables for provider credentials and signing/encryption keys.

Current safeguards include session revocation, admin authorization, tenant/workspace checks, webhook signature verification, cross-site mutation protection, OAuth token encryption, website-crawler SSRF protections, distributed rate limiting, and security headers.

A focused production security review is still required before broad launch.
