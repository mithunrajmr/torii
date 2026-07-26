```markdown
# Implementation Tasks: Domain 0 — Mock CBS Sandbox & Data Seeding Engine

## Steering Commands
* **Build Command:** `npm run build`
* **Test Command:** `npm test --silent`
* **Lint Command:** `npm run lint`

---

## Wave 1: Database Seeding Engine & Core Personas (Zero Dependencies)

- [ ] **TASK-0001: Create Persona Seed Definitions & SQL Generator**
  * **Requirement Ref:** REQ-001
  * **Target Files:** `backend/src/sandbox/personaDefinitions.js`, `backend/src/sandbox/seedEngine.js`
  * **Action:** `personaDefinitions.js` is already implemented — it exports a `PERSONAS` array (default export) and a `getPersonaById(id)` named helper. Each entry has `{ id, label, description, account: { account_number, full_name, email, balance, pan_linked, pan_number }, transactions: [{ amount, error_code, created_at }] }`. Build `seedEngine.js` to consume this array and execute transactional `UPSERT` commands into PostgreSQL `accounts` and `transactions` tables. Note: `accounts` requires a `full_name VARCHAR(255) NOT NULL` column — add migration `003_accounts_add_full_name.sql` if not present.
  * **Verification:** Run unit test `tests/sandbox/seedEngine.test.js` verifying that seeding a persona produces exact account numbers, `full_name`, and error codes in the DB.

- [ ] **TASK-0002: Build Global Reset & Cache Flush Utility**
  * **Requirement Ref:** REQ-002
  * **Target Files:** `backend/src/sandbox/resetEngine.js`
  * **Action:** Build a cleanup service that truncates `teller_tickets`, `audit_logs`, and `transactions`, resets account balances to baseline, and executes a pattern match deletion (`DEL otp:*`, `DEL kiosk_session:*`) in Upstash Redis.
  * **Verification:** Execute `tests/sandbox/resetEngine.test.js` asserting zero active tickets and cleared Redis keys post-reset.

---

## Wave 2: Sandbox API Gateway & Chaos Interceptor (Depends on Wave 1)

- [ ] **TASK-0003: Implement Sandbox Management Endpoints**
  * **Requirement Ref:** REQ-001, REQ-002, REQ-003
  * **Dependencies:** [TASK-0001, TASK-0002]
  * **Target Files:** `backend/src/controllers/sandboxController.js`, `backend/src/routes/sandboxRoutes.js`
  * **Action:** Build REST endpoints: `GET /api/sandbox/personas`, `POST /api/sandbox/seed/:personaId`, `DELETE /api/sandbox/reset`, `POST /api/sandbox/transaction`, and `GET /api/sandbox/ledger`. Wire routes to Express app.
  * **Verification:** Execute API integration suite `tests/api/sandbox_endpoints.test.js`.

- [ ] **TASK-0004: Build Chaos Middleware & Latency Injector**
  * **Requirement Ref:** REQ-004
  * **Dependencies:** [TASK-0003]
  * **Target Files:** `backend/src/middleware/chaosInterceptor.js`, `backend/src/routes/sandboxRoutes.js`
  * **Action:** Implement `POST /api/sandbox/chaos` storing rules in Redis key `chaos:rules`. Create an Express middleware that reads this key; if `cbsLatencyMs > 0`, wrap `next()` in a `setTimeout()` delay when calls hit `/api/auth/*` or `/api/kiosk/*`.
  * **Verification:** Execute `tests/middleware/chaos.test.js` asserting artificial latency injection on intercepted routes.

---

## Wave 3: Neo-Bento Sandbox Control Panel UI (Depends on Wave 2)

- [ ] **TASK-0005: Build Persona Seeder & Chaos Control Bento Cards**
  * **Requirement Ref:** REQ-001, REQ-004
  * **Dependencies:** [TASK-0003, TASK-0004]
  * **Target Files:** `frontend/src/pages/sandbox/SandboxDashboard.jsx`, `frontend/src/components/sandbox/PersonaSeeder.jsx`, `frontend/src/components/sandbox/ChaosControl.jsx`
  * **Action:** Construct the master layout on `#e8ecf2` canvas. Build 6 extruded neumorphic buttons for persona seeding with physical depress active states (`active:shadow-inset`). Build toggle switches and latency sliders in the Chaos Control card wired to `/api/sandbox/chaos`.
  * **Verification:** Execute component test `tests/frontend/PersonaSeeder.test.jsx`.

- [ ] **TASK-0006: Build Live Ledger Inspector & Custom Tx Injector**
  * **Requirement Ref:** REQ-002, REQ-003
  * **Dependencies:** [TASK-0003, TASK-0005]
  * **Target Files:** `frontend/src/components/sandbox/LedgerInspector.jsx`, `frontend/src/components/sandbox/TxInjector.jsx`
  * **Action:** Build an inset well table displaying real-time balances, KYC statuses, and active error codes fetched via 5-second polling from `/api/sandbox/ledger`. Build an inset form allowing manual injection of custom error codes and amounts via `/api/sandbox/transaction`. Add a prominent "Global Factory Reset" CTA button.
  * **Verification:** Execute E2E sandbox suite `tests/e2e/sandbox_control_plane.test.js` verifying 1-click persona seeding reflects in the live ledger table.