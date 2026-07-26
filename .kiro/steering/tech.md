# Tech Stack & Build System

## Core Technologies

### Frontend
- **React** with React Router for multi-workspace routing (`/kiosk`, `/mobile/:token`, `/teller`)
- **Tailwind CSS** for styling
- Component-based architecture with error boundaries

### Backend
- **Node.js** API Gateway pattern
- **Express.js** for REST endpoints
- JWT-based authentication with role-based access control (RBAC)

### Databases & Storage
- **PostgreSQL** (via Supabase) for persistent data:
  - `accounts` — customer records and PAN link status
  - `teller_tickets` — HITL review queue
  - `audit_logs` — immutable compliance trail
  - `transactions` — core banking ledger
- **Redis** (Upstash) for ephemeral state:
  - OTP codes (300s TTL)
  - Kiosk sessions (1800s TTL)
  - QR tokens (600s TTL)
- **Supabase Object Storage** for document images (private bucket `pan-documents`)

### AI & ML

#### Vision OCR — Google Gemini Flash (Multimodal)
`backend/src/ai/visionAgent.js` uses the **Google Gemini Flash** multimodal model via the `@google/genai` SDK.

**Architectural decision:** Gemini Flash was chosen over IBM Granite 3.2 Vision for the OCR step because its native multimodal API accepts raw image buffers directly and returns structured JSON in a single call, with no separate file-upload round-trip. This keeps the Vision leg of `Promise.all()` within the 45-second kiosk SLA. IBM Granite Vision requires the watsonx.ai inference endpoint with a separate upload step, adding latency and a second token-management surface inside the same parallel swarm. Gemini Flash delivers equivalent PAN extraction accuracy at lower p95 latency.

- Configured via `GEMINI_API_KEY` and `GEMINI_MODEL` env vars (default: `gemini-flash-latest`)
- **Only `visionAgent.js` may import `@google/genai`** — no other module uses this SDK

#### Watchdog AML & Advisor Cross-Sell — IBM watsonx Orchestrate
`backend/src/ai/orchestrateClient.js` is the **exclusive** transport for all watsonx Orchestrate calls.

- Handles IBM Cloud IAM token exchange (`WATSONX_ORCHESTRATE_API_KEY`) with a 55-minute cache window
- Exposes `chatWithAgent(agentId, userMsg, context)` and `chatWithAgentJSON(agentId, userMsg, fallback, context)`
- Endpoint configured via `WATSONX_ORCHESTRATE_ENDPOINT`
- **No other module may call the watsonx SDK or IAM token endpoint directly**

#### Deployed Orchestrate Agents
| Env Var | Agent | Purpose |
|---|---|---|
| `WXO_WATCHDOG_AGENT_ID` | Watchdog AML | AML structuring detection |
| `WXO_ADVISOR_AGENT_ID` | Advisor Cross-Sell | Personalised offer generation |
| `WXO_FAQ_AGENT_ID` | FAQ Agent | 40-entry KB + `log_faq_query` tool |
| `WXO_LOCALIZER_AGENT_ID` | Localizer | Multilingual input/output |
| `WXO_ORCHESTRATOR_AGENT_ID` | Master Orchestrator | Intent classification router |

#### AI Agent Swarm (parallel execution)
`swarmOrchestrator.js` executes three agents via `Promise.all()` — **never sequentially**:
- **Vision** — Gemini multimodal OCR + Levenshtein name matching (`visionAgent.js`)
- **Watchdog** — AML structuring checks (watsonx Orchestrate)
- **Advisor** — cross-sell offer generation (watsonx Orchestrate)

Governance sidecar (`governanceSidecar.js`) runs fire-and-forget on every state transition — PII redaction + immutable `audit_logs` write.

## Project Structure

```
/frontend               # React UI workspaces
├── /kiosk             # Branch kiosk interface
├── /mobile            # Mobile PWA
└── /teller            # HITL dashboard

/backend
├── /src
│   ├── /controllers   # Request handlers
│   ├── /routes        # Express route definitions
│   ├── /services      # Business logic (storage, notifications)
│   ├── /ai            # AI agent implementations
│   ├── /db            # Database connections & migrations
│   ├── /cache         # Redis client & session management
│   ├── /middleware    # RBAC, chaos interceptor
│   └── /sandbox       # Dev-only: persona seeding, reset engine

/tests
├── /api               # REST endpoint tests
├── /ai                # AI agent unit tests
├── /frontend          # Component tests
└── /e2e               # Full flow integration tests
```

## Common Commands

### Build & Development
```bash
npm run dev:all        # Start BOTH Vite frontend AND Express backend (recommended)
npm run dev            # Start Vite frontend only
npm run backend:dev    # Start Express backend only
npm run build          # Build frontend (Vite)
npm run migrate        # Run all database migrations against live Supabase
```

### Testing
```bash
npm test               # Run full test suite
npm test --silent      # Run tests with minimal output
npm run test:unit      # Unit tests only (tests/api + tests/cache)
npm run test:e2e       # End-to-end tests
```

### Code Quality
```bash
npm run lint           # Run linter
npm run format         # Format code
```

## Architecture Patterns

### API Gateway Pattern
All external service calls (IBM watsonx, Supabase, Redis) must route through backend controllers. Frontend never imports admin SDKs directly.

### Parallel AI Execution
The AI swarm uses `Promise.all()` to execute Vision, Watchdog, and Advisor agents concurrently — **never sequentially**.

### Stateless Horizontal Scaling
Never use in-memory state (e.g., `new Map()`). All session state must be stored in Redis to support serverless scaling.

### Event-Driven Governance
`governanceSidecar.js` intercepts all state transitions to redact PII and append audit logs. Always called fire-and-forget **after** `res.json()` — never blocks the primary response path.

## Redis Key Namespace Reference
All keys defined in `backend/src/cache/sessionManager.js`. Key prefixes used by `resetEngine.js` during factory reset must match exactly:

| Key Pattern | TTL | Purpose |
|---|---|---|
| `otp:<accountId>` | 300s | OTP value |
| `otp:attempts:<accountId>` | 300s | Failed attempt counter |
| `otp:locked:<accountId>` | 300s | Lockout flag |
| `session:<jti>` | 1800s | Active kiosk session |
| `qr:<token>` | 600s | Single-use QR token |
| `upload:attempts:<accountId>` | 600s | Mobile OCR retry counter |
| `chaos:rules` | none | Sandbox chaos injection rules |

## Security & Compliance

- **PII Protection**: All PAN numbers must be masked (`XXXXX-1234-X`) in logs and audit trails
- **Signed URLs**: Document images use 300-second signed URLs from Supabase Storage (teller view)
- **Session Security**: QR tokens expire after 10 minutes (mobile validity); kiosk sessions expire after 30 minutes of inactivity
- **RBAC**: Teller endpoints require `TELLER` role in JWT; Kiosk endpoints require `CUSTOMER` role + live Redis session
