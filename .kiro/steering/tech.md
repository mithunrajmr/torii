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
  - Kiosk sessions (120s TTL)
  - QR tokens (600s TTL)
- **Supabase Object Storage** for document images (private bucket `pan-documents`)
- **Vector Database** for policy document embeddings (RAG queries)

### AI & ML
- **IBM watsonx Orchestrate** — all agent calls route through `backend/src/ai/orchestrateClient.js`:
  - Handles IBM Cloud IAM token exchange (`WATSONX_ORCHESTRATE_API_KEY`) and caches the token with a 55-minute refresh window
  - Exposes `chatWithAgent(agentId, userMsg, context)` for text responses and `chatWithAgentJSON(agentId, userMsg, fallback, context)` for structured JSON responses
  - Endpoint configured via `WATSONX_ORCHESTRATE_ENDPOINT` (e.g. `https://api.us-south.watson-orchestrate.cloud.ibm.com`)
  - No other module may import the watsonx SDK directly — all AI calls must go through this client
- **IBM watsonx.ai** with Granite models:
  - Granite 3.2 Vision for OCR extraction
  - Localizer Agent for STT/translation
  - RAG Agent for policy question-answering
- **AI Agent Swarm** with parallel execution:
  - Vision Agent (OCR + fuzzy matching)
  - Watchdog Agent (AML structuring checks)
  - Advisor Agent (cross-sell recommendations)
  - Regulator Agent (PII redaction)
- **watsonx.governance** for compliance sidecar

## Project Structure

```
/frontend               # React UI workspaces
├── /kiosk             # Branch kiosk interface
├── /mobile            # Mobile PWA
└── /teller            # HITL dashboard

/backend
├── /src
│   ├── /api           # Express routes
│   ├── /controllers   # Request handlers
│   ├── /services      # Business logic
│   ├── /ai            # AI agent implementations
│   ├── /db            # Database connections & migrations
│   ├── /cache         # Redis client & session management
│   └── /middleware    # RBAC, governance sidecar

/tests
├── /api               # REST endpoint tests
├── /ai                # AI agent unit tests
├── /frontend          # Component tests
└── /e2e               # Full flow integration tests
```

## Common Commands

### Build & Development
```bash
npm run build          # Build frontend and backend
npm run dev            # Start development servers
npm run migrate        # Run database migrations
```

### Testing
```bash
npm test               # Run full test suite
npm test --silent      # Run tests with minimal output
npm run test:unit      # Unit tests only
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
The Regulator Agent acts as a middleware sidecar that intercepts all state transitions to redact PII and append audit logs.

## Security & Compliance

- **PII Protection**: All PAN numbers must be masked (`XXXXX-1234-X`) in logs and audit trails
- **Signed URLs**: Document images use 5-minute signed URLs from Supabase Storage
- **Session Security**: Time-limited tokens for QR handoff (45s kiosk display, 10m mobile validity)
- **RBAC**: Teller endpoints require `TELLER` role in JWT
