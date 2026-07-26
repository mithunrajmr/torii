# Implementation Tasks: Core Integration & Stabilization Roadmap

## Steering Commands
* **Build Command:** `npm run build`
* **Test Command:** `npm test --silent`
* **Lint Command:** `npm run lint`
* **Dev Command:** `npm run dev:all`

---

## Execution Waves & Dependency Graph

### Wave 1: Codebase Hygiene, Configuration & Silent Bug Fixes (Zero Dependencies)
*These tasks eliminate dead code, fix key mismatches, and establish clean multi-terminal development environments.*

- [ ] **TASK-INT-101: Clean Dead Imports & Document OCR Model Decision**
  * **Requirement Ref:** REQ-INT-01 (Architecture Hygiene)
  * **Target Files:** `backend/src/index.js`, `tech.md`, `design.md`
  * **Action:** Remove unused dead imports (`existsSync`, `DIST_DIR`) from `backend/src/index.js`. Formally document the architectural decision in `tech.md` and `design.md` explaining why Google Gemini Multimodal Flash is used for Vision OCR (`visionAgent.js`) while IBM watsonx Orchestrate is used for Watchdog and Advisor agents, aligning all system documentation with live code.
  * **Verification:** Run `npm run lint` and ensure no unused variable warnings remain in `index.js`.

- [x] **TASK-INT-102: Fix Session Cache Key Prefix Mismatch on Factory Reset**
  * **Requirement Ref:** REQ-INT-02 (Cache Reliability)
  * **Target Files:** `backend/src/sandbox/resetEngine.js`, `backend/src/cache/sessionManager.js`
  * **Action:** Inspect `sessionManager.js` to confirm exact key structures (e.g., `session:<jti>`, `otp:<account>`, `qr:<token>`). Update `_flushMockRedis` and the live Redis flush patterns in `resetEngine.js` so that executing a Global Factory Reset reliably clears all live kiosk sessions, OTPs, and QR tokens without key prefix mismatches.
  * **Verification:** Execute unit test `tests/sandbox/resetEngine.test.js` asserting that active `session:<jti>` keys are completely purged after `DELETE /api/sandbox/reset`.

- [ ] **TASK-INT-103: Add Unified Concurrently Development Scripts**
  * **Requirement Ref:** REQ-INT-03 (Developer Experience)
  * **Target Files:** `package.json`
  * **Action:** Install `concurrently` as a dev dependency. Add `"backend:dev": "node backend/src/index.js"` and `"dev:all": "concurrently \"npm run dev\" \"npm run backend:dev\""` to the root `package.json` so developers can run both the Vite frontend and Express API gateway from a single command.
  * **Verification:** Run `npm run dev:all` and verify both localhost ports (Frontend 3000/5173 and Backend API) initialize without port binding conflicts.

---

### Wave 2: Proactive Radar & Kiosk Pipeline Completion (Depends on Wave 1)
*These tasks decouple production components from sandbox routes and wire real ledger lookups to Kiosk voice queries.*

- [x] **TASK-INT-201: Implement Dedicated System Radar Endpoint**
  * **Requirement Ref:** REQ-INT-04 (Production Decoupling)
  * **Dependencies:** [TASK-INT-101]
  * **Target Files:** `backend/src/controllers/systemController.js`, `backend/src/routes/systemRoutes.js`, `backend/src/index.js`
  * **Action:** Create `GET /api/system/radar`. Query `transactions` joined with `accounts` for the most recent failed transaction occurring within the last 24 hours (e.g., `ERR_PAN_MISSING_OVER_50K`), returning a structured triage payload. Mount `/api/system` in `index.js` without auth guards for public kiosk accessibility.
  * **Status:** ✅ Done — `systemController.js` implemented. Returns deduplicated failures (up to 20, one per masked account), with `****NNNN` account masking, first-name-only identity, and graceful degradation on DB failure.
  * **Verification:** Execute API test `tests/api/system_radar.test.js` asserting the endpoint returns the latest failure payload without requiring sandbox authentication.

- [ ] **TASK-INT-202: Refactor Section G Radar to Consume System Endpoint**
  * **Requirement Ref:** REQ-INT-04 (Production Decoupling)
  * **Dependencies:** [TASK-INT-201]
  * **Target Files:** `frontend/src/pages/landing/components/SectionGRadar.jsx`
  * **Action:** Modify the 5-second polling loop in `SectionGRadar.jsx` to fetch `GET /api/system/radar` instead of `/api/sandbox/ledger`. Ensure the UI transitions cleanly between the green idle state and the pulsing amber active roadblock state based on real production telemetry.
  * **Verification:** Execute component test `tests/frontend/SectionGRadar.test.jsx` verifying correct rendering when consuming `/api/system/radar`.

- [ ] **TASK-INT-203: Wire Real Ledger Lookups for Kiosk ACCOUNT_STATUS Intent**
  * **Requirement Ref:** REQ-INT-05 (Kiosk Intelligence)
  * **Dependencies:** [TASK-INT-102]
  * **Target Files:** `backend/src/controllers/kioskController.js`
  * **Action:** In `kioskController.js`, replace the placeholder voice response for `routing.intent === 'ACCOUNT_STATUS'`. Dynamically query the Core Banking System (`accountController.js` logic or PostgreSQL `accounts`/`transactions` tables) for the authenticated user's balance, PAN linking status, and recent transaction history, returning a formatted text-to-speech string.
  * **Verification:** Execute integration test `tests/api/kiosk_queries.test.js` asserting that an `ACCOUNT_STATUS` intent returns real account balance numbers in the TTS payload.

---

### Wave 3: AI Swarm Observability & Closed-Loop Telemetry (Depends on Wave 2)
*These tasks activate the dormant performance tables and wire teller outcomes back into agent analytics.*

- [ ] **TASK-INT-301: Wire Swarm Execution Telemetry to Performance Ledger**
  * **Requirement Ref:** REQ-INT-06 (AI Governance & Telemetry)
  * **Dependencies:** [TASK-INT-101]
  * **Target Files:** `backend/src/ai/swarmOrchestrator.js`
  * **Action:** Update `executeParallelSwarm()`. Upon resolution of the `Promise.all()` worker threads, execute an asynchronous database insert into `agent_performance_log` recording `agent_id` (VISION_OCR, WATCHDOG_AML, ADVISOR), `session_id`, execution latency in milliseconds, confidence scores, and output status.
  * **Verification:** Execute swarm test `tests/ai/swarm_telemetry.test.js` verifying that triggering an upload writes 3 distinct rows to `agent_performance_log`.

- [x] **TASK-INT-302: Close the HITL Feedback Loop on Teller Action**
  * **Requirement Ref:** REQ-INT-06 (AI Governance & Telemetry)
  * **Dependencies:** [TASK-INT-301]
  * **Target Files:** `backend/src/controllers/tellerController.js`
  * **Action:** In `POST /api/teller/action` (approve/reject/escalate), execute an update query against `agent_performance_log` WHERE `session_id` matches the ticket's session. Set `teller_outcome` to the final action and calculate `teller_override` (e.g., setting `true` if the Vision agent had high confidence but the teller rejected the document).
  * **Status:** ✅ Done — `writeAgentFeedback()` fires after every teller action. `teller_override = true` when rejecting ai_confidence ≥ 0.80 or approving ai_confidence < 0.60. `getPendingTickets` now selects `session_id` to carry the link. Always fire-and-forget.
  * **Verification:** Execute E2E HITL test `tests/e2e/hitl_feedback_loop.test.js` asserting that rejecting a ticket updates `agent_performance_log.teller_override` to `true`.

- [ ] **TASK-INT-303: Surface FAQ Knowledge Base Gaps in Teller Dashboard**
  * **Requirement Ref:** REQ-INT-07 (KB Analytics)
  * **Dependencies:** [TASK-INT-203]
  * **Target Files:** `frontend/src/pages/teller/Dashboard.jsx`, `frontend/src/pages/teller/components/FaqGapsPanel.jsx`
  * **Action:** Create a Neo-Bento component `FaqGapsPanel.jsx` that consumes existing endpoint `GET /api/teller/faq-gaps` (which reads from `faq_query_log`). Embed this panel as a selectable tab or secondary view in `Dashboard.jsx`, allowing branch staff to see unresolved customer kiosk queries and identify missing knowledge base articles.
  * **Verification:** Execute component test `tests/frontend/FaqGapsPanel.test.jsx` verifying rendering of unresolved query strings.

---

### Wave 4: Edge Failsafe UX & Error Handling (Depends on Wave 3)
*These tasks eliminate silent edge failures on mobile client sessions.*

- [ ] **TASK-INT-401: Build Dedicated Mobile QR Expiration Recovery UI**
  * **Requirement Ref:** REQ-INT-08 (Edge UX Resilience)
  * **Dependencies:** [TASK-INT-102]
  * **Target Files:** `frontend/src/pages/mobile/DocumentUpload.jsx`, `frontend/src/routes/index.jsx`
  * **Action:** In `DocumentUpload.jsx`, intercept cases where `consumeQRToken` returns `null` or throws `ERR_INVALID_OR_EXPIRED_QR_TOKEN`. Instead of showing a generic upload failure, render a dedicated Neo-Bento card explaining that the secure 10-minute session has expired, providing a prominent button: **[🔄 Return to Kiosk to Scan Fresh QR]** that redirects to `/kiosk`.
  * **Verification:** Execute E2E test `tests/e2e/mobile_expired_qr.test.js` simulating an expired Redis token and asserting the recovery UI renders correctly.