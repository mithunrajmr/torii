├── /kiosk (Kiosk Workspace)
│   ├── KioskLogin.jsx (Numeric keypad, OTP input)
│   └── KioskTriage.jsx (Voice visualizer, QR canvas, 45s auto-reset timer)
├── /mobile (Mobile PWA Workspace)
│   ├── DocumentUpload.jsx (Camera capture, compression, retry counter)
│   └── StatusPoller.jsx (5s interval polling, cross-sell offer display)
└── /teller (Dashboard Workspace)
    ├── QueueList.jsx (Sidebar ticket list, AML warning badges)
    ├── SecureImageDisplay.jsx (Signed URL fetcher, pan/zoom viewer)
    └── ApprovalControls.jsx (Action buttons, rejection reason dropdown)


    ## 3. The Execution Plan (`tasks.md`)
This file is formatted to let Kiro build a dependency graph and execute commands across distinct concurrency waves.

### `# File: tasks.md`
```markdown
# Implementation Plan: Autonomous Branch Operations & Compliance Engine

## Steering Commands
* **Build Command:** `npm run build`
* **Test Command:** `npm test --silent`
* **Lint Command:** `npm run lint`

---

## Execution Waves & Dependency Graph

### Wave 1: Foundation & Data Layer (Zero Dependencies)
*These tasks can be executed concurrently by Kiro AI agents.*

- [ ] **TASK-101: Initialize Database Schemas & Migrations**
  * **Requirement Ref:** REQ-01, REQ-05, REQ-06
  * **Target Files:** `backend/src/db/migrations/001_initial_schema.sql`, `backend/src/db/index.js`
  * **Action:** Write SQL migration for `accounts`, `teller_tickets`, and `audit_logs`. Configure Supabase PostgreSQL connection pool.
  * **Verification:** Run `npm run migrate` and execute unit test `tests/db/schema.test.js`.

- [ ] **TASK-102: Configure Redis Cache & Ephemeral State Management**
  * **Requirement Ref:** REQ-01, REQ-02
  * **Target Files:** `backend/src/cache/redisClient.js`, `backend/src/cache/sessionManager.js`
  * **Action:** Set up Upstash Redis REST client. Create helper functions for setting OTPs (300s TTL), Kiosk sessions (120s TTL), and QR tokens (600s TTL).
  * **Verification:** Run unit test `tests/cache/redis.test.js`.

- [ ] **TASK-103: Scaffold React Workspace & Route Architecture**
  * **Requirement Ref:** REQ-01, REQ-02, REQ-05
  * **Target Files:** `frontend/src/App.jsx`, `frontend/src/routes/index.jsx`
  * **Action:** Configure React Router with three base paths (`/kiosk`, `/mobile/:token`, `/teller`). Set up Tailwind CSS and global error boundaries.
  * **Verification:** Execute `npm run build` in `/frontend`.

---

### Wave 2: Kiosk Authentication & Proactive Triage (Depends on Wave 1)
*Processes after TASK-101, TASK-102, and TASK-103 pass verification.*

- [ ] **TASK-201: Implement Kiosk Auth Gateway & Ledger Lookup**
  * **Requirement Ref:** REQ-01
  * **Dependencies:** [TASK-101, TASK-102]
  * **Target Files:** `backend/src/controllers/authController.js`, `backend/src/routes/authRoutes.js`
  * **Action:** Build `/api/auth/verify`. Query `transactions` table for recent `ERR_PAN_MISSING_OVER_50K` codes. Issue short-lived Kiosk JWT.
  * **Verification:** Test endpoint via `tests/api/auth.test.js`.

- [x] **TASK-201b: Register Kiosk API Route in Express Gateway**
  * **Requirement Ref:** REQ-01, REQ-02
  * **Dependencies:** [TASK-201]
  * **Target Files:** `backend/src/index.js`, `backend/src/routes/kioskRoutes.js`
  * **Action:** Import `kioskRoutes` and mount at `app.use('/api/kiosk', kioskRoutes)`. Route exposes `POST /api/kiosk/query` (requires `CUSTOMER` JWT) which runs the Localizer → Orchestrator → FAQ pipeline.
  * **Status:** ✅ Done — route registered in `index.js`.

- [ ] **TASK-202: Build Kiosk UI & 45-Second QR Handoff Timer**
  * **Requirement Ref:** REQ-02
  * **Dependencies:** [TASK-103, TASK-201]
  * **Target Files:** `frontend/src/pages/kiosk/KioskTriage.jsx`, `frontend/src/components/QRCodeGenerator.jsx`
  * **Action:** Render dynamic QR code from `/api/mobile/qr`. Implement strict 45-second countdown timer using `useEffect` that wipes local state and redirects to login upon expiry.
  * **Verification:** Execute component test `tests/frontend/KioskTriage.test.jsx`.

---

### Wave 3: AI Swarm & Mobile Document Processing (Depends on Wave 2)
*Processes the parallel AI workers and mobile handoff pipeline.*

- [ ] **TASK-301: Integrate Supabase Object Storage Upload Service**
  * **Requirement Ref:** REQ-03
  * **Dependencies:** [TASK-101]
  * **Target Files:** `backend/src/services/storageService.js`
  * **Action:** Implement secure file upload to private bucket `pan-documents`. Create helper for generating 300-second signed read URLs for staff.
  * **Verification:** Test upload and URL signing via `tests/services/storage.test.js`.

- [ ] **TASK-302: Build IBM Granite Vision OCR Worker & Retry Gate**
  * **Requirement Ref:** REQ-03
  * **Dependencies:** [TASK-301]
  * **Target Files:** `backend/src/ai/visionAgent.js`, `backend/src/controllers/mobileController.js`
  * **Action:** Connect to watsonx.ai Granite 3.2 Vision API. Parse `name` and `pan_number`. If clarity < 0.80, throw `RETAKE_IMAGE`. If attempt count >= 3, default to `PENDING_MANUAL_REVIEW`.
  * **Verification:** Execute AI mock test `tests/ai/vision.test.js`.

- [ ] **TASK-303: Implement Parallel Swarm Orchestrator (Watchdog & Advisor)**
  * **Requirement Ref:** REQ-04, REQ-06
  * **Dependencies:** [TASK-302]
  * **Target Files:** `backend/src/ai/swarmOrchestrator.js`
  * **Action:** Use `Promise.all()` to trigger Watchdog Agent (query CBS history for structuring) and Advisor Agent (generate FD cross-sell text) concurrently with Vision OCR.
  * **Verification:** Execute integration test `tests/ai/swarm.test.js`.

- [ ] **TASK-304: Build Mobile PWA Upload UI & Polling Client**
  * **Requirement Ref:** REQ-03, REQ-05
  * **Dependencies:** [TASK-103, TASK-303]
  * **Target Files:** `frontend/src/pages/mobile/DocumentUpload.jsx`, `frontend/src/components/StatusPoller.jsx`
  * **Action:** Build camera upload interface with client-side image compression. Implement 5-second interval polling to `/api/mobile/status/:token` to display real-time teller decision.
  * **Verification:** Execute E2E mobile flow test `tests/e2e/mobileFlow.test.js`.

---

### Wave 4: HITL Teller Dashboard & Governance Sidecar (Depends on Wave 3)
*Finalizes the verification loop and compliance audit requirements.*

- [ ] **TASK-401: Implement watsonx.governance PII Redaction Sidecar**
  * **Requirement Ref:** REQ-06
  * **Dependencies:** [TASK-101]
  * **Target Files:** `backend/src/ai/governanceSidecar.js`
  * **Action:** Create middleware/sidecar that intercepts all system state transitions, regex-masks PAN strings (`XXXXX-1234-X`), and inserts immutable records into `audit_logs`.
  * **Verification:** Execute governance unit test `tests/ai/governance.test.js`.

- [ ] **TASK-402: Build Teller API Endpoints & Role-Based Access Control**
  * **Requirement Ref:** REQ-05
  * **Dependencies:** [TASK-301, TASK-401]
  * **Target Files:** `backend/src/routes/tellerRoutes.js`, `backend/src/controllers/tellerController.js`, `backend/src/middleware/rbac.js`
  * **Action:** Build ticket list getter and `/api/teller/action` (approve/reject). Enforce `TELLER` role via JWT middleware. On approval, update `accounts.pan_linked = true`.
  * **Verification:** Test RBAC and ticket execution via `tests/api/teller.test.js`.

- [ ] **TASK-403: Build Teller HITL Dashboard & Signed URL Viewer**
  * **Requirement Ref:** REQ-05
  * **Dependencies:** [TASK-103, TASK-402]
  * **Target Files:** `frontend/src/pages/teller/Dashboard.jsx`, `frontend/src/components/SecureImageDisplay.jsx`, `frontend/src/components/ApprovalControls.jsx`
  * **Action:** Build side-by-side UI showing pre-verified OCR JSON against the SecureImageDisplay. Disable "Approve" button if ticket has `aml_flagged: true`, forcing compliance escalation.
  * **Verification:** Execute full suite E2E test `tests/e2e/hitlLoop.test.js`.