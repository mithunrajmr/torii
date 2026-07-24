# Project Structure & Conventions

## Folder Layout

```
/frontend/src
├── /pages
│   ├── /kiosk
│   │   ├── KioskLogin.jsx          # Numeric keypad, OTP input
│   │   └── KioskTriage.jsx         # Voice visualizer, QR canvas, 45s auto-reset
│   ├── /mobile
│   │   ├── DocumentUpload.jsx      # Camera capture, compression, retry counter
│   │   └── StatusPoller.jsx        # 5s polling, cross-sell offer display
│   └── /teller
│       ├── Dashboard.jsx           # HITL queue + side-by-side review
│       ├── QueueList.jsx           # Ticket list, AML warning badges
│       ├── SecureImageDisplay.jsx  # Signed URL fetcher, pan/zoom viewer
│       └── ApprovalControls.jsx    # Action buttons, rejection dropdown
├── /components                     # Shared reusable components
├── /routes
│   └── index.jsx                   # React Router: /kiosk, /mobile/:token, /teller
└── App.jsx

/backend/src
├── /ai
│   ├── orchestrateClient.js        # IBM watsonx Orchestrate REST client — IAM token exchange + agent chat; all AI calls route through here
│   ├── visionAgent.js              # Granite 3.2 Vision OCR, clarity gate, retry logic
│   ├── swarmOrchestrator.js        # Promise.all() parallel swarm coordinator
│   └── governanceSidecar.js        # PII redaction middleware + audit log writer
├── /controllers
│   ├── authController.js           # Kiosk auth, CBS ledger lookup, JWT issuance
│   ├── mobileController.js         # Upload handling, swarm trigger
│   └── tellerController.js         # Ticket actions, approval/rejection logic
├── /routes
│   ├── authRoutes.js
│   ├── mobileRoutes.js
│   └── tellerRoutes.js
├── /services
│   └── storageService.js           # Supabase Storage upload + signed URL generation
├── /middleware
│   └── rbac.js                     # JWT role validation (TELLER, COMPLIANCE)
├── /cache
│   ├── redisClient.js              # Upstash Redis REST client
│   └── sessionManager.js           # TTL helpers for OTP, kiosk, QR tokens
└── /db
    ├── index.js                    # Supabase PostgreSQL connection pool
    └── /migrations
        └── 001_initial_schema.sql  # accounts, teller_tickets, audit_logs, transactions

/tests
├── /api                            # Supertest endpoint tests
├── /ai                             # AI agent mock/unit tests
├── /cache                          # Redis unit tests
├── /services                       # Storage service tests
├── /frontend                       # React component tests
└── /e2e                            # Full flow integration tests
```

## Naming Conventions

- **React components**: PascalCase filenames and exports (`KioskTriage.jsx`)
- **Backend modules**: camelCase filenames (`authController.js`, `visionAgent.js`)
- **Database tables**: snake_case (`teller_tickets`, `audit_logs`, `pan_linked`)
- **API routes**: kebab-case paths (`/api/mobile/qr`, `/api/teller/action`)
- **Environment variables**: SCREAMING_SNAKE_CASE (`SUPABASE_URL`, `REDIS_TOKEN`)
- **Error codes**: SCREAMING_SNAKE_CASE strings (`ERR_PAN_MISSING_OVER_50K`, `RETAKE_IMAGE`, `PENDING_MANUAL_REVIEW`)

## Module Boundaries (Enforced)

| Layer | Can Import From | Cannot Import From |
|---|---|---|
| `/frontend` | `/frontend`, backend REST API (fetch) | `/backend`, cloud SDKs directly |
| `/backend/controllers` | `/services`, `/ai`, `/cache`, `/middleware` | `/frontend` |
| `/backend/ai` | `/db`, `/cache`, external AI SDKs | `/controllers` |
| `/backend/middleware` | `/db`, `/cache` | `/ai`, `/services` |

## Key Invariants

- **AI transport layer**: All IBM watsonx Orchestrate calls must go through `orchestrateClient.js` (`chatWithAgent` / `chatWithAgentJSON`) — no other module may call the watsonx SDK or IAM token endpoint directly. Requires `WATSONX_ORCHESTRATE_API_KEY` and `WATSONX_ORCHESTRATE_ENDPOINT` env vars.
- **Parallel swarm**: `visionAgent`, `watchdogAgent`, and `advisorAgent` must always be invoked via `Promise.all()` in `swarmOrchestrator.js` — never sequentially
- **PII gate**: Every code path that reads a PAN number must pass through `governanceSidecar.js` before logging or writing to `audit_logs`
- **No in-memory state**: Session tokens, OTPs, and kiosk state live exclusively in Redis — never in Node.js module-level variables or `Map`/`Set` objects
- **AML hard block**: Any ticket with `aml_flagged: true` must have the Approve action disabled in `ApprovalControls.jsx` and `tellerController.js`
- **Signed URL expiry**: Documents are served only via 300s (teller) signed URLs — never via public bucket URLs

## Implementation Waves (Dependency Order)

1. **Wave 1** — DB migrations, Redis client, React scaffold (no dependencies)
2. **Wave 2** — Kiosk auth, QR generation (depends on Wave 1)
3. **Wave 3** — AI swarm, mobile upload pipeline (depends on Wave 2)
4. **Wave 4** — Teller dashboard, governance sidecar (depends on Wave 3)
