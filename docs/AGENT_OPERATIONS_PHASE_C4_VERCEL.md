# C.4 Vercel engineering connection preparation

Prepared, not connected. The new server-only `agent-operations-vercel-connection.js` wraps the existing exact-deployment GET adapter. There is no OAuth exchange, token creation, managed vault, installed integration or active private gateway route. Work's Vercel connection is used only for development verification, never inherited by CallerCore agents.

## Register once, authorize each action

Prepare an API integration selected only for project `prj_AkD7VoSNCE6fRYXQnXkX1ywGqjLX` in team `team_6Rg3DdCrvOml6oEGwx6Ndf1I`. Provider console permissions: **Project Read**, **Integration Configuration Read**, and **Deployment Read/Write** for the requested future engineering lifecycle. Do not request environment variables, domains, billing, team/user administration or drains. The initial CallerCore adapter exposes only fixed GET inspection; provider write capability is not an agent grant. Deployment writes can also cancel/delete deployments, so future execution requires separately reviewed exact actions and explicit owner authority. Project selection does not distinguish Preview from Production: CallerCore must enforce environment/branch/task/release restrictions independently.

The supported provider OAuth exchange requires an owner-registered integration, exact HTTPS callback, client credentials and installation consent. Its authorization code must be exchanged server-side once, with owner/workspace-bound single-use state and approved encrypted storage. That callback/store is not implemented or activated here: deployment origin, owner-approved integration identity and managed secret broker are prerequisites. No fabricated connect URL or plaintext credential form is exposed. See [official integration permissions and exchange](https://vercel.com/docs/integrations/create-integration/vercel-api-integrations).

A project-scoped personal token is a fallback requiring a separate owner decision; it has project read/write capability, not a native read-only guarantee. Do not reuse a developer/team token. See [token scoping](https://vercel.com/docs/accounts/access-tokens).

## Prepared adapter behavior

The future trusted broker must validate live installation selection, exact team/project, disabled state, actual permissions and expiry, returning normalized facts only to the server. Local Redis authorization must remain authoritative through the existing gateway callback before broker access, immediately before transport, and before accepting a result. A constant callback is only a test substitute, never production authority.

The adapter accepts only deployment ID and exact source SHA; it appends the fixed team context, uses the existing bounded Preview/source/project checks, rejects arbitrary methods/URLs and returns sanitized identity/status. A six-second whole-operation deadline includes stalled broker and response paths. Cancellation/revocation rejects late results without retries. Token values never enter receipts. Broad, foreign, expired, disabled or all-project credentials fail closed.

Alias assignment is provider metadata, not independent alias resolution. Raw logs, environment values, billing/usage evidence and release-fingerprint remote probes are not implemented by this adapter. Cost visibility requires a separately justified provider permission; do not silently add Billing scope. No deployment mutation is callable.

## Owner-dependent next step

Confirm the business-owned integration identity and secure token/key storage. Register the proposed scopes and install only on the existing CallerCore project; the owner completes provider consent. Then implement the guarded callback/broker wiring and prove actual successful/denied reads and revocation before marking connected. No new provider account, paid service or credential has been created during this preparation.
