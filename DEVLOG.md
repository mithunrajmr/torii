# TORII — Development Log & AI Context File

> Single source of truth for project state, decisions, and session history. Read before making code changes.

---

## Project Identity & Tech Stack

- **Name:** TORII — Autonomous Branch Operations & Compliance Engine (IBM Hackon)
- **Goal:** Eliminate branch queues via kiosk self-resolution (<45s), AI triage, and teller HITL approval.

| Layer | Technology |
|---|---|
| **Frontend** | React + Vite + Tailwind CSS (Vercel) |
| **Backend** | Node.js + Express ES modules (Render.com) |
| **Database & Storage** | Supabase PostgreSQL + Supabase Private Storage (`pan-documents`) |
| **Cache & Sessions** | Upstash Redis (REST) |
| **AI Infrastructure** | IBM watsonx Orchestrate (ADK v2.1.0) |
| **AI Models** | IBM Granite 3.2 Vision (OCR), Granite 3.8B Instruct (Reasoning/Orchestration) |

---

## Repository Structure Overview

```
/backend/src/
  index.js                  — Express app, route wiring, startup checks, async health probes
  /ai/                      — orchestrateClient, intentRouter, faqAgent, visionAgent, swarmOrchestrator, governanceSidecar
  /controllers/             — authController, mobileController, tellerController, kioskController, accountController
  /routes/                  — authRoutes, mobileRoutes, tellerRoutes, kioskRoutes
  /middleware/              — rbac.js (requireRole JWT verification)
  /db/                      — index.js (mock + pg pool), /migrations/ (001 to 005)
  /cache/                   — redisClient.js (Upstash REST wrapper), sessionManager.js (30m session TTL)
  /services/                — storageService.js (Supabase Storage), notificationService.js (Resend API)

/watsonx-orchestrate/
  import-all.sh             — Agent/tool import runner
  /agents/                  — vision-ocr, watchdog-aml, advisor, faq, localizer, orchestrator
  /tools/                   — extract_pan, aml_watchdog, advisor, bank_faq, localizer, orchestrator

/frontend/src/
  /pages/kiosk/             — KioskLogin.jsx (OTP), KioskTriage.jsx (FAQ + Voice STT/TTS + QR)
  /pages/mobile/            — DocumentUpload.jsx (PAN upload), StatusPoller.jsx (5s polling)
  /pages/teller/            — Dashboard.jsx, QueueList.jsx, TellerLogin.jsx, TellerAccounts.jsx
  /pages/sandbox/           — SandboxDashboard.jsx, PersonaSeeder, LedgerInspector, TxInjector, ChaosControl
```

---

## API Endpoints Reference

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/health` | None | System health check (probes DB + Redis) |
| POST | `/api/auth/otp/request` | None | Request OTP for account |
| POST | `/api/auth/otp/verify` | None | Verify OTP → Kiosk JWT |
| POST | `/api/auth/staff-login` | None | Staff login (TELLER001/torii2024) → Teller JWT |
| POST | `/api/kiosk/query` | Kiosk JWT | Kiosk voice/text query → Localizer → Orchestrator → FAQ |
| POST | `/api/mobile/upload` | QR Token | Mobile PAN upload → Swarm execution |
| GET | `/api/mobile/status/:token` | None | Mobile ticket status poller |
| GET / POST | `/api/teller/tickets` / `/action` | Teller JWT | List tickets / Approve or Reject HITL ticket |
| GET / POST / PUT | `/api/teller/accounts` | Teller JWT | Account search, auto-sequence creation, and updates |
| ALL | `/api/sandbox/*` | None | Persona seeding, transaction injection, ledger reset, chaos rules |
| GET | `/api/system/radar` | None | Proactive radar: most recent failed transaction in last 24 h with customer metadata |

---

## AI Agent & Pipeline Architecture

```
KIOSK PIPELINE: Voice/Text → POST /api/kiosk/query → Localizer (Lang/PII) → Master Orchestrator (Intent)
               ├── Intent: PAN_MISSING   → Return showQR: true → KioskTriage displays QR
               ├── Intent: FAQ_QUERY     → FAQ Agent (40-entry KB + keyword search) → Voice TTS
               └── Intent: OTHER         → Escalation or Account status lookup

MOBILE SWARM:   Customer scans QR → Mobile upload → Promise.all([
                   Vision OCR Agent    (Granite Vision 3.2 - Name & PAN extract)
                   Watchdog AML Agent  (Granite 3.8B - Structuring detection)
                   Advisor Agent       (Granite 3.8B - Personalized cross-sell)
                ]) → Create teller_ticket → Status Polling

TELLER HITL:    Teller UI → List Pending → Fetch 5-min signed image URL → Approve / Reject → DB update & Audit Log
```

---

## Database Migrations

- `001_initial_schema.sql` — Core tables: `accounts`, `teller_tickets`, `audit_logs`, `transactions`.
- `002_accounts_add_email.sql` — Adds nullable `email` column to `accounts`.
- `003_agent_architecture.sql` — Adds `aml_flagged`, `name_mismatch_score`, `reviewed_by`, `rejection_reason`.
- `004_faq_feedback_loop.sql` — `faq_query_log` and `faq_kb_proposals` feedback tables.
- `005_accounts_created_at.sql` — Adds `created_at` timestamp and `account_number_seq` auto-sequence counter.

---

## Development Session Summary

- **Session 1 (Hackathon Base):** Initial backend, frontend pages, Redis session management, and initial 3 AI agents.
- **Session 2 (Orchestration Pipeline):** Created `bank_faq_tool`, `localizer_tool`, `orchestrator_tool`, and agents. Built `kioskController.js` and `intentRouter.js`.
- **Session 3 (FAQ-First Kiosk & KB Expansion):** Expanded FAQ KB to 40 entries. Created `004_faq_feedback_loop.sql`. Rebuilt `KioskTriage.jsx` for FAQ-first interaction. Fixed 4 critical backend bugs.
- **Session 4 (Production Readiness & Staff Login):** Built `notificationService.js` (Resend/fallback), `/api/auth/staff-login`, `TellerLogin.jsx`, and Web Speech API STT/TTS in Kiosk.
- **Session 5 (Session Overhaul):** Extended Kiosk TTL to 30 mins with automatic heartbeat refresh. Added 5-min UI inactivity timeout and QR regeneration without logout.
- **Session 6 (OTP Root Cause & Resiliency):** Fixed Upstash Redis string type coercion bug in `redisClient.js`. Increased DB/CBS timeouts to 9s/5s for cold starts. Made `/api/health` probe live DB/Redis.
- **Session 7 (Teller Account CRUD):** Built `accountController.js` and `TellerAccounts.jsx` drawer for account management and email updates.
- **Session 8 (Auto Account Numbering):** Added migration `005`, auto-generating 10-digit account numbers via `account_number_seq`.
- **Session 9 (Audit & Hook Setup):** Codebase verification and `.kiro/hooks/devlog-updater.json` setup.
- **Session 10 (Sandbox Dashboard & Testing):** Completed `/sandbox` control plane (Persona Seeder, Ledger Inspector, Chaos Control, Tx Injector) and `POST /api/dev/teller-token`. Added `tests/e2e/domain1_proactive_triage.spec.js`.
- **Session 11 (System Radar Endpoint):** Implemented `GET /api/system/radar` in `systemController.js` and wired it via `systemRoutes.js`. Returns most recent unresolved failed transaction within 24 h joined with `accounts.full_name` and masked `account_number`. Degrades gracefully on DB failure. Powers the Domain 1.5 Interception Radar polling component.
- **Session 12 (Teller reviewed_by UUID Guard):** Fixed `handleTellerAction` in `tellerController.js` — `reviewed_by` is only written when the JWT `sub` is a valid UUID. The dev staff-login path issues a JWT with `sub: "TELLER001"` (non-UUID), which previously caused a PostgreSQL type error on the `reviewed_by UUID` column. Non-UUID teller IDs now resolve to `NULL` in that column.
- **Session 13 (Cache Key Prefix Fix — TASK-INT-102):** Fixed `_flushMockRedis` in `resetEngine.js`. The old code used `kiosk_session:<accountId>` keys which no longer match `sessionManager.js` (which uses `session:<jti>`). Updated to enumerate correct namespaces: `otp:<id>`, `otp:attempts:<id>`, `otp:locked:<id>`, `upload:attempts:<id>`, `chaos:rules`, `health:ping`. Added inline comment explaining that `session:<jti>` and `qr:<token>` keys are UUID-based and handled by the real-Redis SCAN path or cleared naturally on process restart in mock mode.

---

# TORII — Development Log & AI Context File

> Single source of truth for project state, decisions, and session history. Read before making code changes.

---

## Project Identity & Tech Stack

- **Name:** TORII — Autonomous Branch Operations & Compliance Engine (IBM Hackon)
- **Goal:** Eliminate branch queues via kiosk self-resolution (<45s), AI triage, and teller HITL approval.

| Layer | Technology |
|---|---|
| **Frontend** | React + Vite + Tailwind CSS (Vercel) |
| **Backend** | Node.js + Express ES modules (Render.com) |
| **Database & Storage** | Supabase PostgreSQL + Supabase Private Storage (`pan-documents`) |
| **Cache & Sessions** | Upstash Redis (REST) |
| **AI Infrastructure** | IBM watsonx Orchestrate (ADK v2.1.0) |
| **AI Models** | IBM Granite 3.2 Vision (OCR), Granite 3.8B Instruct (Reasoning/Orchestration) |

---

## Repository Structure Overview

```
/backend/src/
  index.js                  — Express app, route wiring, startup checks, async health probes
  /ai/                      — orchestrateClient, intentRouter, faqAgent, visionAgent, swarmOrchestrator, governanceSidecar
  /controllers/             — authController, mobileController, tellerController, kioskController, accountController
  /routes/                  — authRoutes, mobileRoutes, tellerRoutes, kioskRoutes
  /middleware/              — rbac.js (requireRole JWT verification)
  /db/                      — index.js (mock + pg pool), /migrations/ (001 to 005)
  /cache/                   — redisClient.js (Upstash REST wrapper), sessionManager.js (30m session TTL)
  /services/                — storageService.js (Supabase Storage), notificationService.js (Resend API)

/watsonx-orchestrate/
  import-all.sh             — Agent/tool import runner
  /agents/                  — vision-ocr, watchdog-aml, advisor, faq, localizer, orchestrator
  /tools/                   — extract_pan, aml_watchdog, advisor, bank_faq, localizer, orchestrator

/frontend/src/
  /pages/kiosk/             — KioskLogin.jsx (OTP), KioskTriage.jsx (FAQ + Voice STT/TTS + QR)
  /pages/mobile/            — DocumentUpload.jsx (PAN upload), StatusPoller.jsx (5s polling)
  /pages/teller/            — Dashboard.jsx, QueueList.jsx, TellerLogin.jsx, TellerAccounts.jsx
  /pages/sandbox/           — SandboxDashboard.jsx, PersonaSeeder, LedgerInspector, TxInjector, ChaosControl
```

---

## API Endpoints Reference

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/health` | None | System health check (probes DB + Redis) |
| POST | `/api/auth/otp/request` | None | Request OTP for account |
| POST | `/api/auth/otp/verify` | None | Verify OTP → Kiosk JWT |
| POST | `/api/auth/staff-login` | None | Staff login (TELLER001/torii2024) → Teller JWT |
| POST | `/api/kiosk/query` | Kiosk JWT | Kiosk voice/text query → Localizer → Orchestrator → FAQ |
| POST | `/api/mobile/upload` | QR Token | Mobile PAN upload → Swarm execution |
| GET | `/api/mobile/status/:token` | None | Mobile ticket status poller |
| GET / POST | `/api/teller/tickets` / `/action` | Teller JWT | List tickets / Approve or Reject HITL ticket |
| GET / POST / PUT | `/api/teller/accounts` | Teller JWT | Account search, auto-sequence creation, and updates |
| ALL | `/api/sandbox/*` | None | Persona seeding, transaction injection, ledger reset, chaos rules |
| GET | `/api/system/radar` | None | Proactive radar: most recent failed transaction in last 24 h with customer metadata |

---

## AI Agent & Pipeline Architecture

```
KIOSK PIPELINE: Voice/Text → POST /api/kiosk/query → Localizer (Lang/PII) → Master Orchestrator (Intent)
               ├── Intent: PAN_MISSING   → Return showQR: true → KioskTriage displays QR
               ├── Intent: FAQ_QUERY     → FAQ Agent (40-entry KB + keyword search) → Voice TTS
               └── Intent: OTHER         → Escalation or Account status lookup

MOBILE SWARM:   Customer scans QR → Mobile upload → Promise.all([
                   Vision OCR Agent    (Granite Vision 3.2 - Name & PAN extract)
                   Watchdog AML Agent  (Granite 3.8B - Structuring detection)
                   Advisor Agent       (Granite 3.8B - Personalized cross-sell)
                ]) → Create teller_ticket → Status Polling

TELLER HITL:    Teller UI → List Pending → Fetch 5-min signed image URL → Approve / Reject → DB update & Audit Log
```

---

## Database Migrations

- `001_initial_schema.sql` — Core tables: `accounts`, `teller_tickets`, `audit_logs`, `transactions`.
- `002_accounts_add_email.sql` — Adds nullable `email` column to `accounts`.
- `003_agent_architecture.sql` — Adds `aml_flagged`, `name_mismatch_score`, `reviewed_by`, `rejection_reason`.
- `004_faq_feedback_loop.sql` — `faq_query_log` and `faq_kb_proposals` feedback tables.
- `005_accounts_created_at.sql` — Adds `created_at` timestamp and `account_number_seq` auto-sequence counter.

---

## Development Session Summary

- **Session 1 (Hackathon Base):** Initial backend, frontend pages, Redis session management, and initial 3 AI agents.
- **Session 2 (Orchestration Pipeline):** Created `bank_faq_tool`, `localizer_tool`, `orchestrator_tool`, and agents. Built `kioskController.js` and `intentRouter.js`.
- **Session 3 (FAQ-First Kiosk & KB Expansion):** Expanded FAQ KB to 40 entries. Created `004_faq_feedback_loop.sql`. Rebuilt `KioskTriage.jsx` for FAQ-first interaction. Fixed 4 critical backend bugs.
- **Session 4 (Production Readiness & Staff Login):** Built `notificationService.js` (Resend/fallback), `/api/auth/staff-login`, `TellerLogin.jsx`, and Web Speech API STT/TTS in Kiosk.
- **Session 5 (Session Overhaul):** Extended Kiosk TTL to 30 mins with automatic heartbeat refresh. Added 5-min UI inactivity timeout and QR regeneration without logout.
- **Session 6 (OTP Root Cause & Resiliency):** Fixed Upstash Redis string type coercion bug in `redisClient.js`. Increased DB/CBS timeouts to 9s/5s for cold starts. Made `/api/health` probe live DB/Redis.
- **Session 7 (Teller Account CRUD):** Built `accountController.js` and `TellerAccounts.jsx` drawer for account management and email updates.
- **Session 8 (Auto Account Numbering):** Added migration `005`, auto-generating 10-digit account numbers via `account_number_seq`.
- **Session 9 (Audit & Hook Setup):** Codebase verification and `.kiro/hooks/devlog-updater.json` setup.
- **Session 10 (Sandbox Dashboard & Testing):** Completed `/sandbox` control plane (Persona Seeder, Ledger Inspector, Chaos Control, Tx Injector) and `POST /api/dev/teller-token`. Added `tests/e2e/domain1_proactive_triage.spec.js`.
- **Session 11 (System Radar Endpoint):** Implemented `GET /api/system/radar` in `systemController.js` and wired it via `systemRoutes.js`. Returns most recent unresolved failed transaction within 24 h joined with `accounts.full_name` and masked `account_number`. Degrades gracefully on DB failure. Powers the Domain 1.5 Interception Radar polling component.
- **Session 12 (Teller reviewed_by UUID Guard):** Fixed `handleTellerAction` in `tellerController.js` — `reviewed_by` is only written when the JWT `sub` is a valid UUID. The dev staff-login path issues a JWT with `sub: "TELLER001"` (non-UUID), which previously caused a PostgreSQL type error on the `reviewed_by UUID` column. Non-UUID teller IDs now resolve to `NULL` in that column.
- **Session 13 (Cache Key Prefix Fix — TASK-INT-102):** Fixed `_flushMockRedis` in `resetEngine.js`. The old code used `kiosk_session:<accountId>` keys which no longer match `sessionManager.js` (which uses `session:<jti>`). Updated to enumerate correct namespaces: `otp:<id>`, `otp:attempts:<id>`, `otp:locked:<id>`, `upload:attempts:<id>`, `chaos:rules`, `health:ping`. Added inline comment explaining that `session:<jti>` and `qr:<token>` keys are UUID-based and handled by the real-Redis SCAN path or cleared naturally on process restart in mock mode.

- **Session 14 (Infra Verification Script):** Added `backend/scripts/verify-infra.js` — a standalone Node.js diagnostic that loads `.env` and probes PostgreSQL, Upstash Redis, Supabase Storage (key format + REST API reachability), Google Gemini Flash (live `generateContent` call), and IBM watsonx Orchestrate (IAM token exchange + endpoint ping). Prints a colour-coded summary table and exits with code 1 on any `FAILING` service. Run with `node backend/scripts/verify-infra.js`.
- **Session 15 (Swarm Telemetry & PII Gate):** Wired per-agent execution telemetry into `swarmOrchestrator.js`. `executeParallelSwarm()` now accepts `opts: { sessionId, ticketId }` and times each agent leg individually. Three fire-and-forget rows are written to `agent_performance_log` after `Promise.all()` resolves — input/output snapshots are PII-redacted via `governanceSidecar.redactPayload` before insert. Return value now includes `_meta` with the live `VISION_OCR` thresholds (`clarity_threshold`, `name_match_hard_reject`, `name_match_soft_flag`) sourced from `agent_config` table via `configService`. Removed unused `computeNameMatchScore` import from `visionAgent.js`. `agent_performance_log` schema added to `docs/Dbscheme-postgres.txt`.

- **Session 16 (HITL Feedback Loop — TASK-INT-302):** Implemented `writeAgentFeedback()` in `tellerController.js`. After every APPROVE / REJECT / ESCALATE action, the `agent_performance_log` rows for the ticket's `session_id` are updated with `teller_outcome` (`APPROVED` | `REJECTED` | `ESCALATED`) and `teller_override` (`true` when a teller rejects a high-confidence result ≥ 0.80, or approves a low-confidence result < 0.60). Always fire-and-forget — never blocks the teller response. Also added `session_id` to the `SELECT` in `getPendingTickets` so the feedback link is available in the ticket object returned to the UI.

- **Session 18 (Agent Debug & Validation Console):** Created isolated `/debug/agents` route and `/api/debug/*` API endpoints (`debugRoutes.js`, `AgentDebugConsole.jsx`, `AgentCard.jsx`). Provides isolated testing, parameter tuning, raw SSE stream inspection, and structured output parsing for all 6 watsonx Orchestrate agents with real Supabase data or manual inputs. Added unit test suite `tests/api/debugController.test.js`.
- **Session 19 (Re-architected Orchestration Flow & Instant Login Swarm):** Shifted Watchdog AML Agent (`runWatchdogAgent`), Compliance check, and Advisor Cross-Sell Agent (`runAdvisorAgent`) execution to run **instantly on Kiosk OTP verification (`verifyOTP`)** via `Promise.all()`. Added `executeLoginSwarm()` in `swarmOrchestrator.js` returning `login_swarm` payload. Updated `KioskLogin.jsx` & `KioskTriage.jsx` to display instant Interception Radar alerts and the **Instant Advisor Personalised Bank Offer Banner** immediately upon login. Optimized `askFaqAgent` in `faqAgent.js` to perform instant local KB matching (< 5ms) while racing the watsonx FAQ agent with a 2.5s timeout.

- **Session 20 (QR Retry Fix, Vision OCR Resiliency, Audit History Tab & Dynamic Campaign Engine):** Fixed mobile QR retry token deletion bug in `mobileController.js` using `getQRToken` so `RETAKE_IMAGE` attempts do not invalidate session tokens. Wrapped all parallel agent legs in `swarmOrchestrator.js` in isolated try/catch fallbacks to eliminate `fetch failed` errors. Upgraded `visionAgent.js` with multi-tier regex fallback OCR parsing for Name (`D MANIKANDAN`), PAN (`BNZPM2501F`), and DOB (`16/07/1986`). Fixed `ocr_data` JSON stringification bug in `tellerController.js` and `Dashboard.jsx`. Added **Audit History** tab to Teller Workstation with `/api/teller/tickets?status=all` status badge support. Transformed Advisor Agent into a dynamic 3-offer campaign suite (`runAdvisorAgent`) with a 6-second auto-rotating notification banner and interactive **Exclusive Product Reservation Modal** on the Kiosk (`KioskTriage.jsx`).

- **Session 21 (Enterprise Multi-Service Platform Expansion):** Expanded TORII into a universal 7-service branch operational platform (`FULL_KYC`, `AADHAAR_LINK`, `PAN_LINK`, `ADDRESS_CHANGE`, `NOMINEE_UPDATE`, `ACCOUNT_UPGRADE`, `HIGH_VALUE_CLEARANCE`). Created DB migration `006_expanded_branch_services.sql` and `SERVICE_REGISTRY` schema (`serviceSchemas.js`). Built `/api/services` API suite (`serviceController.js`). Implemented fuzzy multi-document entity matcher (`entityMatcherAgent.js`). Built `DynamicServiceForm.jsx`, `MultiDocVault.jsx`, and `DigitalSignaturePad.jsx` with 4px Midnight Black ink, high-DPI coordinate scaling, and live preview badge. Fixed mobile deep link parameter routing in `authController.js` and `KioskTriage.jsx`. Updated `tellerController.js` for service-specific account mutations (`ADDRESS_CHANGE`, `NOMINEE_UPDATE`, `AADHAAR_LINK`, `FULL_KYC`), and enhanced Teller `Dashboard.jsx` / `QueueList.jsx` with service badges, dynamic field inspection, and customer signature verification. Fixed Watsonx Orchestrate double-stringified JSON unwrapping in `orchestrateClient.js`. Passed all 19 unit & integration tests 100%.

---

## Pending Tasks / Next Steps

1. Re-import `bank_faq_tool.py` + `faq-agent/agent.yaml` into watsonx Orchestrate (`log_faq_query` tool & 40-entry KB).
2. Wire `ACCOUNT_STATUS` intent directly to `accountController.js` logic in `kioskController.js`.
3. Implement `/auditor` route and read-only audit log viewer.
4. ~~Remove unused `existsSync` and `DIST_DIR`/`join` dead imports from `backend/src/index.js`~~ ✅ Done (TASK-INT-101 partial).
5. ~~Implement `GET /api/system/radar` in `systemController.js`~~ ✅ Done (Session 11 / TASK-INT-201 complete). Returns deduplicated failures from last 24 h joined with `accounts.full_name`; masks account to `****NNNN` and name to first-name + last-initial; degrades gracefully on DB failure.
6. ~~Implement `GET /api/dev/peek-otp?account_number=<num>`~~ ✅ Done (Session 17). Retained as legacy endpoint for curl-based manual testing. `GET /api/dev/kiosk-bypass` added as the preferred single-call replacement (account lookup + OTP gen/verify + JWT issuance + Redis session in one request). Both guarded by `NODE_ENV !== 'production'`. Remove both before production deployment.
7. ~~Build Agent Debug & Validation Console (`/debug/agents`)~~ ✅ Done (Session 18). Isolated testing console for all 6 WXO agents with real Supabase data and live SSE stream inspection.
8. ~~Deploy Instant Swarm on Kiosk Login & Fast Local FAQ Racing~~ ✅ Done (Session 19). Concurrently executes Watchdog AML, Compliance, and Advisor Cross-Sell agents on OTP verification, rendering instant alerts/ads and racing local KB for FAQ queries.
9. ~~QR Retry Fix, Vision OCR Resiliency, Audit History Tab & Dynamic Campaign Engine~~ ✅ Done (Session 20). Fixed QR token retry consumption, added Gemini Vision OCR regex fallback, added Teller Audit History tab, and launched dynamic 3-offer rotating campaign carousel.
10. ~~Enterprise Multi-Service Platform Expansion & E-Signature Pad Upgrade~~ ✅ Done (Session 21). Implemented 7-service branch operational platform, mobile dynamic forms, multi-doc entity matching, digital signature pad, Watsonx JSON unwrap, and Teller multi-service account mutations. Passed 100% test suite.
