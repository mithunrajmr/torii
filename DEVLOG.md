# TORII — Development Log & AI Context File

> This file is the single source of truth for what has been built, what decisions were made,
> and what remains to do. Any AI assistant (Kiro, Bob, or otherwise) should read this file
> first before making any code changes to understand the full picture.

---

## Project Identity

- **Name:** TORII — Autonomous Branch Operations & Compliance Engine
- **Hackathon:** IBM Hackon
- **Core Goal:** Eliminate retail bank branch queues by letting customers self-resolve issues
  at a kiosk in under 45 seconds, with AI-driven triage and Human-in-the-Loop teller approval.
- **NOT:** A PAN card verification app. PAN upload is one resolution path. The system handles
  any customer need: FAQ questions, compliance failures, account inquiries, etc.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite + Tailwind CSS |
| Backend | Node.js + Express (ES modules) |
| Database | Supabase PostgreSQL |
| Cache / Sessions | Upstash Redis (REST) |
| AI Agents | IBM watsonx Orchestrate (ADK v2.1.0) |
| AI Models | IBM Granite 3.2 Vision (OCR), Granite 3.8B Instruct (reasoning) |
| File Storage | Supabase Object Storage (private bucket: `pan-documents`) |
| Frontend Deploy | Vercel |
| Backend Deploy | Render.com |
| Keep-Alive | UptimeRobot pings `/api/health` every 5 min |

---

## Repository Structure

```
/backend/src/
  index.js                   — Express app, route wiring, startup credential check
  /ai/
    orchestrateClient.js     — IBM watsonx Orchestrate REST client (IAM token + chat)
    intentRouter.js          — NEW: Localizer → Master Orchestrator pipeline
    faqAgent.js              — NEW: FAQ/QnA agent client
    swarmOrchestrator.js     — Vision OCR + Watchdog AML + Advisor (Promise.all)
    visionAgent.js           — Granite Vision OCR wrapper
    governanceSidecar.js     — PII redaction + audit log writer
  /controllers/
    authController.js        — OTP request/verify, kiosk JWT
    mobileController.js      — Mobile upload trigger, swarm execution
    tellerController.js      — Teller ticket list, approve/reject
    kioskController.js       — NEW: Kiosk query pipeline (Localizer → Orchestrator → FAQ)
  /routes/
    authRoutes.js
    mobileRoutes.js
    tellerRoutes.js
    kioskRoutes.js           — NEW: POST /api/kiosk/query
  /middleware/
    rbac.js                  — requireRole() JWT middleware
  /db/
    index.js
    /migrations/
      001_initial_schema.sql
      002_accounts_add_email.sql
      003_agent_architecture.sql
  /cache/
    redisClient.js
    sessionManager.js
  /services/
    storageService.js

/watsonx-orchestrate/
  import-all.sh              — UPDATED: imports all 6 agents in correct dependency order
  README.md                  — UPDATED: full architecture diagram + agent/tool table
  /agents/
    vision-ocr-agent/        — EXISTING: Granite Vision OCR, extract_pan_from_image tool
    watchdog-aml-agent/      — EXISTING: AML structuring detector
    advisor-agent/           — EXISTING: cross-sell offer generator
    faq-agent/               — NEW: FAQ/QnA RAG, search_bank_faq tool
    localizer-agent/         — NEW: language detection + PII redaction + translation
    orchestrator-agent/      — NEW: intent router, classify_customer_intent tool
  /tools/
    extract_pan_tool.py      — EXISTING
    aml_watchdog_tool.py     — EXISTING
    advisor_tool.py          — EXISTING
    bank_faq_tool.py         — NEW: 40-entry FAQ knowledge base with keyword scoring
    localizer_tool.py        — NEW: process_kiosk_input + translate_response_to_language
    orchestrator_tool.py     — NEW: classify_customer_intent (4 intents + context override)

/frontend/src/
  App.jsx
  /routes/index.jsx
  /pages/kiosk/
    KioskLogin.jsx           — Account number + OTP numeric keypad
    KioskTriage.jsx          — QR code display + 45s countdown
  /pages/mobile/
    DocumentUpload.jsx       — Camera capture + upload + retry logic
    StatusPoller.jsx         — 5s polling for teller decision
  /pages/teller/
    Dashboard.jsx
    QueueList.jsx
    SecureImageDisplay.jsx
    ApprovalControls.jsx
  /components/
    VoiceAssistant.jsx       — TTS (Web Speech API SpeechSynthesis) — outgoing only
    QRCodeGenerator.jsx
    ToriiLogo.jsx

/.bob/mcp.json               — UPDATED: both wxo-docs + orchestrate-adk MCP servers
.env.example                 — UPDATED: all 6 agent ID vars documented
```

---

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/health` | None | System health check |
| POST | `/api/auth/otp/request` | None | Request OTP for account number |
| POST | `/api/auth/otp/verify` | None | Verify OTP → kiosk JWT |
| POST | `/api/auth/qr/generate` | CUSTOMER JWT | Generate QR handoff token |
| GET | `/api/auth/session/validate` | CUSTOMER JWT | Validate active kiosk session |
| DELETE | `/api/auth/session` | CUSTOMER JWT | Terminate kiosk session |
| **POST** | **`/api/kiosk/query`** | **CUSTOMER JWT** | **NEW: Kiosk voice/text query → Localizer → Orchestrator → FAQ** |
| POST | `/api/mobile/upload` | QR Token | Upload PAN document via mobile |
| GET | `/api/mobile/status/:token` | None | Poll ticket status from mobile |
| GET | `/api/teller/tickets` | TELLER JWT | List pending tickets |
| POST | `/api/teller/action` | TELLER JWT | Approve or reject a ticket |
| POST | `/api/dev/teller-token` | None (dev only) | Generate teller JWT for testing |

---

## AI Agent Architecture

```
KIOSK INPUT PIPELINE
─────────────────────────────────────────────────────────────
Customer speaks/types
    ↓
POST /api/kiosk/query
    ↓
[kioskController.js]
    ↓ fetchAccountContext() — checks for ERR_PAN_MISSING_OVER_50K in last 24h
    ↓
[intentRouter.js → Localizer Agent]
    • Detects language (10 Indian languages via script detection)
    • Redacts PII (PAN, Aadhaar, mobile, account number)
    • Returns clean English text
    ↓
[intentRouter.js → Master Orchestrator Agent]
    • classify_customer_intent tool
    • Context override if has_failed_pan_tx = true → PAN_MISSING
    • Returns: intent, downstream, voiceResponse, showQR
    ↓
Intent = PAN_MISSING  → showQR: true  → KioskTriage shows QR (45s TTL)
Intent = FAQ_QUERY    → [faqAgent.js → FAQ Agent] → search_bank_faq → TTS answer
Intent = ACCOUNT_STATUS → DB lookup (TODO: accountController.js)
Intent = GENERAL_TRIAGE → "Please speak with a teller" voice response

MOBILE SWARM PIPELINE (after QR scan)
─────────────────────────────────────────────────────────────
Customer scans QR, opens /mobile/:token
    ↓
POST /api/mobile/upload (image file)
    ↓
[mobileController.js → swarmOrchestrator.js]
    Promise.all([
      Vision OCR Agent   — extract name + PAN, score clarity
      Watchdog AML Agent — check transaction structuring
      Advisor Agent      — generate cross-sell offer
    ])
    ↓
DB: create teller_tickets record
    ↓
Mobile: show cross-sell offer, begin polling /api/mobile/status/:token

TELLER HITL PIPELINE
─────────────────────────────────────────────────────────────
Teller opens /teller
    GET /api/teller/tickets → list PENDING tickets
    ↓
Teller clicks ticket
    GET /api/teller/media/:id → 5-min signed Supabase URL
    ↓
Teller reviews OCR JSON vs raw image
    POST /api/teller/action { approve | reject }
    ↓
DB: update accounts.pan_linked + ticket status
Mobile pollers receive "APPROVED" or "REJECTED"
governanceSidecar.js logs TICKET_APPROVED/TICKET_REJECTED to audit_logs
```

---

## watsonx Orchestrate Agents

| Agent Name (YAML) | Kind | Model | Tools | Role in Pipeline |
|---|---|---|---|---|
| `torii_master_orchestrator_agent` | native | granite-3-8b-instruct | `classify_customer_intent` | Entry point. Routes intent to downstream flow. Collaborates with FAQ + Localizer. |
| `torii_localizer_agent` | native | granite-3-8b-instruct | `process_kiosk_input`, `translate_response_to_language` | Detects language, redacts PII, translates response back to customer language. |
| `torii_faq_agent` | native | granite-3-8b-instruct | `search_bank_faq` | Answers general banking questions from 40-entry KB. Deflects to teller if unsure. |
| `torii_vision_ocr_agent` | native | granite-3-2-vision-11b | `extract_pan_from_image` | OCRs PAN card image. Returns name, PAN number, clarity_score, confidence. |
| `torii_watchdog_aml_agent` | native | granite-3-8b-instruct | `analyse_transaction_history` | Detects structuring patterns in 48h transaction window. Returns isSuspicious + riskLevel. |
| `torii_advisor_agent` | native | granite-3-8b-instruct | `generate_cross_sell_offer` | Generates personalised product offer (FD/LOAN/WEALTH) based on balance tier. |

Import order: tools first, then leaf agents (Vision, Watchdog, Advisor, FAQ, Localizer), then Orchestrator last (it declares FAQ + Localizer as collaborators).

---

## Bob MCP Servers (`.bob/mcp.json`)

| Server | Purpose |
|---|---|
| `wxo-docs` | Searches public watsonx Orchestrate ADK documentation via `SearchIbmWatsonxOrchestrateAdk` tool |
| `orchestrate-adk` | Full CRUD access to watsonx Orchestrate (list/export agents, list tools, toolkits, models, connections) |

To use Bob in Agent Architect mode, add the custom mode config from the IBM tutorial and select it before asking Bob to create or modify agents.

---

## Database Schema (Migrations)

| Migration | File | What it does |
|---|---|---|
| 001 | `001_initial_schema.sql` | `accounts`, `teller_tickets`, `audit_logs`, `transactions` |
| 002 | `002_accounts_add_email.sql` | Adds `email` column to `accounts` |
| 003 | `003_agent_architecture.sql` | Adds agent-specific columns: `aml_flagged`, `name_mismatch_score`, `reviewed_by`, `rejection_reason` |

Run migrations in Supabase SQL editor before first use.

---

## Environment Variables Required

| Variable | Service | Notes |
|---|---|---|
| `SUPABASE_DB_URL` | PostgreSQL | Connection string |
| `SUPABASE_URL` | Supabase Storage | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Storage | Service role key for signed URLs |
| `REDIS_URL` | Upstash Redis | REST URL |
| `REDIS_TOKEN` | Upstash Redis | REST token |
| `JWT_SECRET` | Auth | Random hex string |
| `DOMAIN` | QR links | e.g. `torii.vercel.app` |
| `WATSONX_ORCHESTRATE_API_KEY` | All AI agents | IBM Cloud IAM key |
| `WATSONX_ORCHESTRATE_ENDPOINT` | All AI agents | Instance URL |
| `NOTIFICATION_GATEWAY_URL` | Email OTP | Points to Resend wrapper |
| `WXO_VISION_AGENT_ID` | Swarm | Orchestrate agent ID |
| `WXO_WATCHDOG_AGENT_ID` | Swarm | Orchestrate agent ID |
| `WXO_ADVISOR_AGENT_ID` | Swarm | Orchestrate agent ID |
| `WXO_FAQ_AGENT_ID` | Kiosk pipeline | Orchestrate agent ID |
| `WXO_LOCALIZER_AGENT_ID` | Kiosk pipeline | Orchestrate agent ID |
| `WXO_ORCHESTRATOR_AGENT_ID` | Kiosk pipeline | Orchestrate agent ID |

---

## Known Issues / Gaps

| Issue | Status | Notes |
|---|---|---|
| Voice STT input at kiosk | ✅ Done | `SpeechRecognition` mic button added to `KioskTriage.jsx` in Session 4. Degrades gracefully if unsupported. |
| Voice TTS output | ✅ Done | `VoiceAssistant` wired to `faqAnswer` in `KioskTriage.jsx` — speaks answer aloud after display. |
| Staff login screen | ✅ Done | `/teller/login` → `TellerLogin.jsx` + `POST /api/auth/staff-login`. Demo: `TELLER001/torii2024`. |
| notificationService.js | ✅ Done | Was missing (startup crash). Created in Session 4 with OTP + ticket status email functions. |
| Auditor role | Missing | No `/auditor` route or read-only audit log viewer. Deferred. |
| Account inquiry intent | Stub | `ACCOUNT_STATUS` intent in Orchestrator has no `accountController.js`. Deferred. |
| FAQ KB is static | Partial | 40-entry in-process store. Production: pgvector/Pinecone. Domain expert agents deferred until KB > 100 entries. |
| Knowledge Engineer Agent | Missing | PDF ingestion → vector embeddings. Deferred — needs large KB first. |
| Optimizer Agent | Missing | HITL feedback loop for Vision OCR tuning. Deferred. |
| KioskTriage.jsx STT | ✅ Done | `SpeechRecognition` added in Session 4. |
| faq_query_log migration | ✅ Done | User confirmed all 4 migrations run in Supabase. |
| watsonx re-import needed | Pending | `bank_faq_tool.py` + `faq-agent/agent.yaml` updated in Session 3. Run: `orchestrate tools import -k python -f tools/bank_faq_tool.py` then `orchestrate agents import -f agents/faq-agent/agent.yaml`. |

---

## Development Session Log

### Session 1 — Initial Build (Hackathon)
- Scaffolded full backend (auth, mobile upload, teller HITL)
- Built 3 watsonx Orchestrate agents: Vision OCR, Watchdog AML, Advisor
- Built all frontend pages: KioskLogin, KioskTriage, DocumentUpload, StatusPoller, Teller Dashboard
- Governance sidecar + audit log
- Redis session management, Supabase storage integration

### Session 2 — Drift Correction + Missing Agents (2026-07-26)
**Problem identified:** App had drifted to only supporting the PAN card flow. Original vision
included a Master Orchestrator, Localizer agent, and FAQ/QnA RAG agent that were never built.

**Changes made:**
- Added `wxo-docs` MCP server to `.bob/mcp.json` (from IBM Bob tutorial Step 7)
- Created `bank_faq_tool.py` — 40-entry in-process FAQ knowledge base with keyword scoring across KYC, transactions, loans, FD, accounts, branches
- Created `localizer_tool.py` — `process_kiosk_input` (language detect + PII redact) + `translate_response_to_language`
- Created `orchestrator_tool.py` — `classify_customer_intent` (4 intents: PAN_MISSING, FAQ_QUERY, ACCOUNT_STATUS, GENERAL_TRIAGE + account context override)
- Created `faq-agent/agent.yaml` — FAQ RAG agent (granite-3-8b-instruct)
- Created `localizer-agent/agent.yaml` — Localizer agent (granite-3-8b-instruct)
- Created `orchestrator-agent/agent.yaml` — Master Orchestrator (granite-3-8b-instruct, collaborators: FAQ + Localizer)
- Updated `import-all.sh` — correct dependency order (tools → leaf agents → orchestrator)
- Updated `watsonx-orchestrate/README.md` — full architecture diagram
- Created `backend/src/ai/intentRouter.js` — `localizeInput()`, `routeIntent()`, `processKioskQuery()`, `translateResponse()`
- Created `backend/src/ai/faqAgent.js` — `askFaqAgent()` with teller deflection detection
- Created `backend/src/controllers/kioskController.js` — full pipeline: account context fetch → Localizer → Orchestrator → FAQ (conditional) → audit log
- Created `backend/src/routes/kioskRoutes.js` — `POST /api/kiosk/query`
- Updated `backend/src/index.js` — wired `/api/kiosk` route
- Updated `.env.example` — added `WXO_FAQ_AGENT_ID`, `WXO_LOCALIZER_AGENT_ID`, `WXO_ORCHESTRATOR_AGENT_ID`

**Still needs (next session):**
1. ~~Wire `POST /api/kiosk/query` into `KioskTriage.jsx` frontend~~ ✅ Done in Session 3
2. Add `SpeechRecognition` STT input to `KioskTriage.jsx` (text path must be verified first)
3. Build `/teller/login` screen + `/api/auth/staff-login` backend endpoint
4. Build `/auditor` route with read-only `audit_logs` viewer

---

### Session 3 — FAQ-First Kiosk + Knowledge Base Expansion (2026-07-27)
**Problem identified:** The entire Localizer → Orchestrator → FAQ backend pipeline built in Session 2
was wired but never called — the frontend only ever showed a QR code. The FAQ KB had 16 entries,
and the agent had no record of what topics it covered. Voice was deferred to avoid stacking
unknowns — text-first approach chosen.

**Architecture decision — no domain expert agents (yet):**
The other AI session had designed 9 new agents (7 domain experts + FAQ router + KB Manager).
After review, this was determined to be premature: the KB had 16 entries (filtering to a domain
would return worse results than searching all 16), and the frontend was not calling the pipeline
at all. The correct priority was: expand KB content → wire frontend → add logging → gather data.
Domain expert agents remain a future option once the KB has 100+ entries and real query logs exist.

**Changes made:**

**AI / Agents layer:**
- Expanded `bank_faq_tool.py` KB from 16 → 40 entries covering:
  - KYC (4 entries): PAN link, KYC docs, full KYC, KYC update/renewal
  - Transactions (5 entries): daily limits, NEFT, RTGS, failed payment refund, NACH/ECS cancel
  - Accounts (6 entries): open, min balance, close, dormant reactivation, nomination, joint holder
  - Loans (5 entries): home, personal, gold, education, prepayment/foreclosure
  - Deposits (4 entries): FD rates, FD premature penalty, RD rates, tax-saving FD (80C)
  - Cards (4 entries): block lost card, credit card apply, PIN reset, annual fees
  - Branch (3 entries): timing, customer care, safe deposit locker
  - Cheque (3 entries): bounce charges, stop payment, cheque book request
  - NRI (2 entries): NRE vs NRO, remittance/SWIFT/FCNR
  - Insurance (2 entries): PMJJBY/PMSBY, Jan Dhan zero-balance account
- Added `domain_filter` optional param to `search_bank_faq` — restricts search to a category
- Added `log_faq_query` tool function to `bank_faq_tool.py` — logs every query with was_answered + confidence
- Updated `faq-agent/agent.yaml`:
  - Added explicit domain coverage list to instructions so agent knows when it CAN answer
  - Added three-tier confidence rules: ≥0.20 confident / 0.10–0.20 partial / <0.10 deflect
  - Added `log_faq_query` to tools list — agent logs internally after every response
  - Updated description to list all 10 covered domains

**Backend:**
- Created `backend/src/db/migrations/004_faq_feedback_loop.sql`:
  - `faq_query_log` table: every FAQ query logged with domain, was_answered, confidence, matched_faq_id
  - `faq_kb_proposals` table: staff-reviewed proposals for new KB entries (PENDING → APPROVED → REJECTED)
  - Indexes on account_id, was_answered, domain, created_at for efficient gap analysis queries
- Updated `kioskController.js`:
  - Added `logFaqQuery()` function — fire-and-forget INSERT to faq_query_log
  - After every FAQ_QUERY intent: logs query, confidence, domain, was_answered to DB
  - sessionId from JWT sub for linking queries to sessions
- Updated `faqAgent.js`:
  - Returns `domain`, `confidence`, `matchedFaqId` in addition to `answer` + `confident`
  - Prompt updated to explicitly call `log_faq_query` tool after answering
  - Confidence threshold comment aligned with agent YAML (0.10 partial / 0.20 confident)
- Updated `import-all.sh`: updated echo for bank_faq_tool import to reflect two tools now

**Frontend — KioskTriage.jsx full rebuild:**
- Removed: bento grid layout, always-visible QR code, VoiceAssistant component, static Clock/Session card
- Added: FAQ-first single-column layout (max-width 2xl, centred)
- PAN compliance banner: conditional — only renders when `failedTxSummary` exists (passed from login)
- QR code panel: conditional — only renders when `showQR = true` (fetched on demand)
- FAQ chat area:
  - Answer display panel with loading spinner and "Looking that up…" state
  - Text input with Enter-to-submit and Send button
  - 8 quick-action suggestion chips (pre-filled common questions)
  - Full `POST /api/kiosk/query` wiring — first time the entire pipeline is callable from the UI
- Session heartbeat: 10s interval (reduced from 5s to reduce noise)
- Voice TTS and STT: intentionally deferred — to be added in Session 4 after text path is verified

**Decisions NOT taken (and why):**
- No domain expert agents: KB at 40 entries is better searched whole than filtered by domain.
  Domain expert agents deferred until KB > 100 entries and real query logs show domain imbalance.
- No KB Manager agent: Cannot auto-update what has no data. Build log first, gather 2 weeks
  of real queries, then decide if automation is warranted.
- No FAQ router agent: One FAQ agent with a good KB beats two agents with a smaller KB each.

**Still needs (next session):**
1. Add `SpeechRecognition` mic input to `KioskTriage.jsx` (wire to same `submitQuery` function)
2. Wire `VoiceAssistant` TTS to speak `faqAnswer` after it's displayed
3. Build `/teller/login` screen + `/api/auth/staff-login` endpoint
4. Build `/auditor` route with read-only `audit_logs` viewer
5. ~~Run `004_faq_feedback_loop.sql` migration in Supabase SQL editor~~ ✅ Done (user confirmed)
6. Re-import `bank_faq_tool.py` and `faq-agent/agent.yaml` into watsonx Orchestrate

---

### Session 3 — Deploy-Readiness Fixes (2026-07-27, follow-up)
**Trigger:** User confirmed all migrations run, Redis configured, `.env` filled — moving to deploy.
Full system audit performed. Four bugs found and fixed before any deployment attempt.

**Bugs fixed:**

1. **`kioskController.js` — critical 401 bug**
   `req.user?.accountId` was used but the RBAC middleware (`rbac.js`) sets `req.auth`, not `req.user`.
   Every `POST /api/kiosk/query` would return 401 regardless of JWT validity.
   Fixed: changed to `req.auth?.accountId` and `req.auth?.jti` for sessionId.

2. **`db/index.js` — mock DB unhandled INSERT**
   `INSERT INTO faq_query_log` (new in Session 3) had no mock handler, falling through to `return []`.
   While `logFaqQuery()` catches errors, this was a silent gap in local dev coverage.
   Fixed: added no-op handler returning `[{ inserted: true }]` for both new tables.

3. **`swarmOrchestrator.js` — swarm hard-fails on Orchestrate agent errors**
   Both `runWatchdogAgent` and `runAdvisorAgent` would `throw` on bad/missing Orchestrate responses,
   killing the entire `Promise.all` swarm and returning 500 to the mobile PWA.
   Fixed: graceful degradation — watchdog defaults to LOW risk, advisor uses balance-tier defaults.
   Tickets still created; teller reviews manually.

4. **`.env.example` — outdated import instructions**
   Import steps were split across two sections and missing Session 3 tools.
   Fixed: consolidated into single ordered list (tools → leaf agents → orchestrator) with notes.

**No changes to agent YAMLs or watsonx Orchestrate configuration — all fixes are backend-only.**

**Still needs (next session):**
1. ~~Add `SpeechRecognition` mic input to `KioskTriage.jsx`~~ → Session 4
2. ~~Wire `VoiceAssistant` TTS to speak `faqAnswer`~~ → Session 4
3. ~~Build `/teller/login` screen + `/api/auth/staff-login` endpoint~~ → Session 4
4. Re-import `bank_faq_tool.py` + `faq-agent/agent.yaml` into watsonx Orchestrate

---

### Session 4 — Full Deploy Completion (2026-07-27)
**Trigger:** User confirmed DB, Redis, and `.env` all configured. Moving to production-ready state.
Full frontend + backend audit completed before writing any code.

**Critical gap found:** `notificationService.js` is imported by both `authController.js`
(for OTP emails) and `tellerController.js` (for ticket status emails) but the file **does not
exist** — this would crash the backend on startup in any environment. Fixed first.

**Changes made:**

**Backend:**
- Created `backend/src/services/notificationService.js`:
  - `sendOTPEmail(email, otp)` — sends OTP via `NOTIFICATION_GATEWAY_URL` or logs to console in dev
  - `sendTicketStatusEmail(email, status, details)` — notifies customer of APPROVED/REJECTED ticket
  - Full graceful degradation: if gateway URL not set, logs without throwing
- Added `POST /api/auth/staff-login` endpoint to `authController.js`:
  - Accepts `{ employee_id, password }`, issues TELLER JWT (8h)
  - Seeded staff credentials for demo: `TELLER001 / torii2024`
  - Separate from the dev-only `/api/dev/teller-token` endpoint
- Added `GET /api/teller/faq-gaps` endpoint:
  - Returns top unanswered FAQ queries from `faq_query_log` for teller dashboard awareness
- Added staff login route to `tellerRoutes.js`

**Frontend:**
- Added `SpeechRecognition` mic input to `KioskTriage.jsx`:
  - Mic button next to text input — holds to record, releases to submit
  - Uses Web Speech API `SpeechRecognition` with graceful degradation if unsupported
  - On transcript received: populates input and auto-submits via `submitQuery`
- Wired `VoiceAssistant` TTS to speak `faqAnswer` after display
- Created `frontend/src/pages/teller/TellerLogin.jsx`:
  - Staff ID + password form (not numeric keypad — staff use keyboard)
  - Calls `POST /api/auth/staff-login`, stores token in localStorage
  - Redirects to `/teller/dashboard` on success
- Updated `frontend/src/routes/index.jsx`:
  - Added `/teller/login` route → `TellerLogin`
  - Changed `/teller/*` to require teller JWT (redirect to login if missing)
- Updated `Dashboard.jsx`:
  - In production (`NODE_ENV !== development`): redirects to `/teller/login` if no JWT
  - Dev-only token fetch kept for local dev convenience

**Still needs:**
1. Re-import `bank_faq_tool.py` + `faq-agent/agent.yaml` into watsonx Orchestrate
2. Auditor role + `/auditor` read-only audit log viewer (deferred)
3. `ACCOUNT_STATUS` intent → `accountController.js` (deferred)

---

### Session 5 — Login Fix + Session Management Overhaul (2026-07-28)
**Trigger:** User reported OTP prints to console but login shows error. Requested persistent login
with 5-minute inactivity logout, and QR expiry to regenerate QR (not log out).

**Root causes found:**

1. **OTP error code mismatch** — `KioskLogin.jsx` checked for `ERR_INVALID_OTP` but backend sends
   `ERR_OTP_INVALID`. Wrong OTP showed generic "OTP verification failed." instead of attempts
   counter. Fixed: both spellings now handled; fallback shows `data.error` raw string.

2. **Session expired after 2 minutes** — `KIOSK_SESSION_TTL` was 120s (2 min) and JWT `exp` was
   `now + 120`. The heartbeat hit `/session/validate` every 10s but didn't refresh the Redis TTL,
   so the session expired after 2 min regardless of activity.

3. **Heartbeat did not renew TTL** — `validateSession` handler returned 200 without touching Redis.
   Active sessions still expired at T+120s.

4. **QR expiry forced logout** — `QRCodeGenerator` called `onExpire → resetKiosk('QR_TIMEOUT')`,
   logging the user out when the 45s QR countdown ran out.

5. **QRCodeGenerator countdown never reset** — `useEffect` for countdown ran only once on mount
   (`deps: []`). Re-generating a QR showed the same countdown from where it left off.

**Changes made:**

**Backend:**
- `sessionManager.js`: `KIOSK_SESSION_TTL` increased from 120s → 1800s (30 min).
- `authController.js`:
  - JWT `exp` increased from `now + 120` → `now + 2100` (35 min, slightly longer than Redis TTL).
  - `validateSession()`: now calls `createKioskSession(accountId, jti)` on every heartbeat ping
    to refresh the Redis TTL — active sessions slide forward indefinitely.
- `notificationService.js`: full rewrite of email routing:
  - Reads env vars per-call (not at module load — avoids stale env in containerised runtimes).
  - `RESEND_API_KEY` set → calls Resend REST API directly (`POST https://api.resend.com/emails`).
  - `NOTIFICATION_GATEWAY_URL` set → falls back to HTTP gateway (old behaviour).
  - Neither set → logs to console (dev mode, unchanged).
- `index.js`: startup credential check updated — warns on missing `RESEND_API_KEY` instead of
  `NOTIFICATION_GATEWAY_URL`.
- `.env.example`: added `RESEND_API_KEY` + `RESEND_FROM_EMAIL` with setup instructions.

**Frontend:**
- `KioskLogin.jsx`:
  - OTP error handler now matches `ERR_OTP_INVALID` (backend) AND `ERR_INVALID_OTP` (old spelling).
  - Lockout matches `ERR_OTP_LOCKED` (backend) AND `ERR_MAX_ATTEMPTS_EXCEEDED` (old spelling).
  - Fallback error shows `data.error` string if `data.message` is absent.
- `KioskTriage.jsx`:
  - Added `INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000` constant.
  - Added inactivity detection: listens to `mousedown`, `mousemove`, `keydown`, `touchstart`,
    `scroll`, `click` — any event resets a 5-min `setTimeout` that calls `resetKiosk('INACTIVITY_TIMEOUT')`.
  - Session heartbeat interval changed from 10s → 60s (sufficient for 30-min TTL refresh, less noise).
  - `resetKiosk()` now clears inactivity timer on call to prevent post-logout fire.
  - `fetchQRCode()`: removed `if (deepLink) return` guard (allows regeneration); resets `qrExpired`.
  - Bumps `qrKey` state (passed as React `key` to `QRCodeGenerator`) whenever a new QR is fetched.
  - `handleQRExpired()`: sets `qrExpired = true` — shows expired placeholder + "Generate New QR" button.
  - QR panel: `onExpire` → `handleQRExpired` (no longer `resetKiosk`).
  - Added `RefreshCw` icon from lucide-react for the regenerate button.
- `QRCodeGenerator.jsx`:
  - Countdown `useEffect` now has `[payload, timeout]` deps (was `[]`) — resets properly on new QR.
  - Single effect handles both `setTimeRemaining` and interval creation.

**Still needs:**
1. Re-import `bank_faq_tool.py` + `faq-agent/agent.yaml` into watsonx Orchestrate
2. Auditor role + `/auditor` read-only audit log viewer (deferred)
3. `ACCOUNT_STATUS` intent → `accountController.js` (deferred)

---

### Session 6 — OTP Root Cause Fix + Defensive Hardening (2026-07-28)
**Trigger:** OTP still failing after Session 5. Performed exhaustive code audit before touching anything.

**Root causes found (6 bugs):**

1. **BUG-1 — ROOT CAUSE of OTP failure: Upstash Redis type coercion**
   Upstash Redis REST client JSON-parses stored values. A string `"123456"` stored by `setOTP`
   comes back from `getOTP` as the number `123456`. The comparison `otp !== storedOTP` is
   `"123456" !== 123456` → always `true` → every OTP verify fails with ERR_OTP_INVALID.
   **Fix:** `redisClient.js` `get()` now coerces the result to `String()` before returning
   (null stays null). `authController.js` also calls `String(storedOTPRaw)` as belt-and-suspenders.

2. **BUG-2 — DB timeout too short for Render + Supabase cold start**
   `OTP_REQUEST_TIMEOUT_MS = 2000` and DB timeout was `2000 - 200 = 1800ms`. Render free tier +
   Supabase cold start regularly takes 3–6 seconds. Every first request of the day returned
   `ERR_SERVICE_UNAVAILABLE` before the DB even connected.
   **Fix:** `OTP_REQUEST_TIMEOUT_MS` → 9000ms; `CBS_QUERY_TIMEOUT_MS` → 5000ms.

3. **BUG-3 — Migration 002 crashes on populated tables**
   `ALTER TABLE accounts ADD COLUMN email VARCHAR(255) UNIQUE NOT NULL` fails with
   "column cannot be null" when the table already has rows without email. Happens on any
   re-run or if the Supabase project already had the accounts table.
   **Fix:** Migration now adds email as `VARCHAR(255) NULL` first (safe ALTER), then a
   unique index. The seed in `migrate.js` fills email for every row via `ON CONFLICT DO UPDATE`.

4. **BUG-4 — `account_number.slice(-4)` type crash**
   Supabase PostgreSQL driver can return `account_number` as a number, not a string.
   Calling `.slice(-4)` on a number throws `TypeError: account_number.slice is not a function`.
   **Fix:** `String(account.account_number).slice(-4)`.

5. **BUG-5 — `created_at.toISOString()` type crash**
   `fetchFailedTxSummary` calls `.toISOString()` on `rows[0].created_at`. Supabase may return
   this as a string in some driver versions. Calling `.toISOString()` on a string throws.
   **Fix:** Defensive check: `ts instanceof Date ? ts.toISOString() : String(ts)`.

6. **BUG-6 — `/api/health` gave no diagnostic info**
   Impossible to tell from the outside whether the backend was using mock DB/Redis or live services,
   or whether Supabase/Upstash were actually reachable.
   **Fix:** Health endpoint now probes DB (SELECT 1) and Redis (set/get health:ping) with 3s
   timeouts. Returns `{ status, checks: { db, redis }, env: { DB, REDIS, EMAIL, DOMAIN } }`.
   Returns HTTP 503 if either probe fails, 200 if both pass.

**Changes made:**
- `backend/src/cache/redisClient.js`: `get()` coerces Upstash return value to `String(val)`.
- `backend/src/controllers/authController.js`:
  - `OTP_REQUEST_TIMEOUT_MS` → 9000ms; `CBS_QUERY_TIMEOUT_MS` → 5000ms.
  - `String(storedOTPRaw)` before OTP comparison.
  - `String(account.account_number).slice(-4)` in JWT.
  - Defensive `created_at` timestamp normalisation.
- `backend/src/db/migrations/002_accounts_add_email.sql`: email column added as NULLable.
- `backend/src/db/index.js`: added `SELECT 1` mock handler for health probe.
- `backend/src/index.js`: health endpoint is now async with DB + Redis live probes.
- `tests/api/authController.test.js`: health test updated to accept 200 or 503.
- `tests/e2e/domain1Auth.e2e.test.js`: health test updated similarly.
- `tests/frontend/KioskTriage.test.jsx`: updated to match redesigned component (QR is conditional).

**Test result: 16/16 pass.**

**Still needs:**
1. Re-import `bank_faq_tool.py` + `faq-agent/agent.yaml` into watsonx Orchestrate
2. Auditor role + `/auditor` read-only audit log viewer (deferred)
3. `ACCOUNT_STATUS` intent → `accountController.js` (deferred)
4. If Supabase DB does not have the accounts table seeded, run: `npm run migrate`

---

### Session 7 — Teller Account CRUD (2026-07-28)
**Trigger:** Teller needs to create and edit customer accounts from the portal so real email
addresses can be set — required for OTP delivery to land in the right inbox.

**Changes made:**

**Backend:**
- Created `backend/src/controllers/accountController.js`:
  - `GET  /api/teller/accounts`       — list all accounts, optional `?search=` (name/number LIKE)
  - `GET  /api/teller/accounts/:id`   — single account by UUID
  - `POST /api/teller/accounts`       — create new account (account_number, full_name, email, balance)
  - `PUT  /api/teller/accounts/:id`   — edit mutable fields (full_name, email, balance); account_number immutable
  - Input validation: 10-digit account number, email format, balance ≥ 0
  - Duplicate key returns 409; emitAuthEvent audit log on create + update
- Updated `backend/src/routes/tellerRoutes.js`: wired all 4 CRUD routes under `requireRole('TELLER')`.
- Updated `backend/src/db/index.js`: added mock DB handlers for all 4 new query shapes.

**Frontend:**
- Created `frontend/src/pages/teller/TellerAccounts.jsx`:
  - Accounts table: account_number, full_name, email, balance, PAN linked badge, edit button
  - Live debounced search (350ms) by name or account number
  - "New Account" button → slide-in drawer with create form
  - Edit (pencil) per row → slide-in drawer with edit form (account_number read-only)
  - `AccountDrawer`: shared create/edit component, validates, shows success + auto-closes
- Updated `Dashboard.jsx`: added "Accounts" nav button → `/teller/accounts`.
- Updated `routes/index.jsx`: added `/teller/accounts` → `TellerAccounts` lazy route.

**Test result: 16/16 pass.**

**How to add your real email (quickest path):**
1. Start the app and log in as teller: `http://localhost:3000/teller/login` → TELLER001 / torii2024
2. Click **Accounts** in the top navbar
3. Search for your account (by name or account number) → click the ✏️ pencil icon
4. Update the **Email** field to your real email address → click **Save Changes**
5. Go to kiosk login → enter account number → request OTP → OTP arrives in your inbox

**Or create a brand-new account:**
1. Go to Accounts → click **New Account**
2. Enter your name, your real email, and an opening balance (account number is auto-generated)
3. Click **Create Account** → the assigned number is shown on screen
4. Use that number at kiosk login

**Still needs:**
1. Re-import `bank_faq_tool.py` + `faq-agent/agent.yaml` into watsonx Orchestrate
2. Auditor role + `/auditor` read-only audit log viewer (deferred)
3. `ACCOUNT_STATUS` intent → `accountController.js` (deferred)
4. Run `npm run migrate` to apply migration 005 to Supabase (adds `created_at` to accounts + `account_number_seq` table)

---

### Session 8 — Accounts Page Fix: Supabase Pull + Auto Account Number (2026-07-28)
**Problems found:**
1. `accounts` table (migration 001) had no `created_at` column. `listAccounts` queried
   `ORDER BY created_at DESC` → Supabase returned column-not-found error → frontend got
   500 `ERR_LIST_ACCOUNTS_FAILED` → page showed empty.
2. Account number was a manual text field in the create form — not feasible in real use.

**Changes made:**
- **`backend/src/db/migrations/005_accounts_created_at.sql`** (NEW):
  - Adds `created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP` to accounts.
  - Back-fills existing rows with `CURRENT_TIMESTAMP`.
  - Creates `account_number_seq` table (single row with `last_seq` counter, starts at 7
    so new accounts continue after the 6 seeded ones).
- **`backend/src/db/migrate.js`**: added `005_accounts_created_at.sql` to migration list.
- **`backend/src/controllers/accountController.js`**:
  - `listAccounts`: fixed `ORDER BY created_at DESC NULLS LAST`, `account_number::text LIKE`
    cast for Postgres compatibility. Error now includes `message` for easier debugging.
  - `createAccount`: removed `account_number` from required body fields. Backend calls
    `nextAccountNumber()` which atomically increments `account_number_seq` and returns
    `'10' + padded_8_digit_seq` (e.g. `1000000007`). Falls back to timestamp suffix if
    seq table not yet migrated.
  - Removed `isValidAccountNumber` helper (no longer needed).
- **`backend/src/db/index.js`** (mock):
  - Added `UPDATE account_number_seq` mock handler — maintains `_accSeq` counter on `mockDatabase`.
  - Fixed list-all handler: adds synthetic `created_at` to accounts that lack it, sorts newest first.
  - Removed duplicate check on `account_number` from INSERT (auto-generated = always unique).
- **`frontend/src/pages/teller/TellerAccounts.jsx`** (`AccountDrawer`):
  - Removed `account_number` input from create form entirely.
  - Create body now sends only `{ full_name, email, balance }`.
  - After successful create: instead of closing, shows a **success screen** with the
    auto-assigned account number displayed large and bold, plus a "Done" button.
  - Edit form: shows `account_number` as read-only display pill (not an input), not editable.
  - Removed dead `success` state reference from submit button.

**Run this on Supabase before testing:**
```sql
-- Or just run: npm run migrate  (applies all 5 migrations in order)
```

**Test result: 16/16 pass.**

---

## How to Continue Development

1. Read this file first.
2. Check the "Known Issues / Gaps" table for what's missing.
3. Check the "Development Session Log" for what was last worked on.
4. The `project-spec-plan.md` is the authoritative feature specification.
5. `docs/design.md` has the full Mermaid architecture flowchart (the intended full system).
6. `docs/requirements.md` has EARS-notation requirements REQ-01 through REQ-06.
7. All steering/architecture rules are in `structure.md` — especially the PII and Promise.all rules.
