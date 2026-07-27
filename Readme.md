# TORII — Autonomous Branch Operations & Compliance Engine

An enterprise-grade banking kiosk and mobile triage system for Indian retail banks. Intercepts compliance blocks (e.g. unlinked PAN cards causing failed transactions) and resolves them through an AI agent swarm with Human-in-the-Loop teller approval.

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment config
cp .env.example .env   # fill in SUPABASE_DB_URL, REDIS_URL, REDIS_TOKEN, JWT_SECRET, etc.

# Run database migrations
npm run migrate

# Start development servers (frontend + backend)
npm run dev
```

## Running Tests

```bash
npm test                # full suite
npm run test:unit       # unit tests only
npm run test:e2e        # end-to-end tests
```

## Project Layout

```
/frontend    React UI — /kiosk, /mobile/:token, /teller workspaces
/backend     Node.js + Express API Gateway
/tests       Unit, property-based, component, and E2E tests
/docs        Requirements, design flowchart, DB schema, UI reference
/watsonx-orchestrate  IBM watsonx agent & tool definitions
```

See `docs/requirements.md` for the full feature specification and `docs/Dbscheme-postgres.txt` for the PostgreSQL schema.

## API Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | None | System health check |
| POST | `/api/auth/otp/request` | None | Request OTP for account number |
| POST | `/api/auth/otp/verify` | None | Verify OTP, receive kiosk JWT |
| POST | `/api/auth/qr/generate` | CUSTOMER JWT | Generate QR handoff token |
| GET | `/api/auth/session/validate` | CUSTOMER JWT | Validate active kiosk session |
| DELETE | `/api/auth/session` | CUSTOMER JWT | Explicitly terminate kiosk session |
| POST | `/api/mobile/upload` | QR Token | Upload PAN document via mobile |
| GET | `/api/mobile/status/:token` | None | Poll ticket status from mobile |
| GET | `/api/teller/tickets` | TELLER JWT | List pending tickets |
| POST | `/api/teller/action` | TELLER JWT | Approve or reject a ticket |
| GET | `/api/system/radar` | None | Proactive alert: deduplicated failed transactions in last 24 h — returns `{ failures[], activeCount, snapshot_at }` with masked account numbers (`****NNNN`) and first-name-only identity |

## Dev Utilities

### Infrastructure Verification

Run the diagnostic script to probe all external services (PostgreSQL, Redis, Supabase Storage, Gemini, watsonx Orchestrate) and print a colour-coded summary table:

```bash
node backend/scripts/verify-infra.js
```

The script loads `.env` automatically and exits with code `1` if any service is in a `FAILING` state. Use this before deploying or after changing credentials to confirm every integration is live.

### Single-call Kiosk Bypass (non-production only)

When `NODE_ENV` is not `production`, a single endpoint handles the full kiosk auth flow (account lookup → OTP generation → OTP verification → JWT issuance) without sending an email. Useful for demos and automated testing:

```bash
curl "http://localhost:5000/api/dev/kiosk-bypass?account_number=1000000001"
```

Response:
```json
{
  "jwt": "<signed CUSTOMER JWT>",
  "failed_tx_summary": { "count": 1, "most_recent_amount": 75000, "most_recent_created_at": "..." },
  "account_number": "1000000001",
  "note": "Dev bypass — single call, no email. Never use in production."
}
```

Use the returned `jwt` as `Authorization: Bearer <jwt>` on any `/api/auth/*` or `/api/kiosk/*` endpoint. **This endpoint is disabled in production.**

### Peek OTP (non-production only, legacy)

A legacy helper to read the current OTP stored in Redis for a given account (useful for curl-based testing after manually calling `/api/auth/otp/request`):

```bash
curl "http://localhost:5000/api/dev/peek-otp?account_number=1000000001"
```

### Generate a Teller JWT (non-production only)

When `NODE_ENV` is not `production`, a helper endpoint is available for testing the teller dashboard without going through the full kiosk auth flow:

```bash
curl -X POST http://localhost:5000/api/dev/teller-token
```

Response:
```json
{
  "teller_jwt": "<signed JWT with role=TELLER, valid 8 hours>",
  "note": "Add as Authorization: Bearer <token> header. Valid for 8 hours. Dev mode only."
}
```

Use the returned token as `Authorization: Bearer <teller_jwt>` on any `/api/teller/*` endpoint. **This endpoint is disabled in production.**

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_DB_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes | Upstash Redis REST URL |
| `REDIS_TOKEN` | Yes | Upstash Redis REST token |
| `JWT_SECRET` | Yes | Secret for signing kiosk/teller JWTs |
| `DOMAIN` | Yes | Public domain for QR deep-link URLs |
| `WATSONX_ORCHESTRATE_API_KEY` | Yes | IBM Cloud IAM API key |
| `WATSONX_ORCHESTRATE_ENDPOINT` | Yes | watsonx Orchestrate API base URL |
| `NOTIFICATION_GATEWAY_URL` | Yes | OTP email dispatch service URL |
| `NODE_ENV` | No | Set to `production` to harden the server |
