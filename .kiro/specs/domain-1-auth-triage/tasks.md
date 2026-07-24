# Implementation Plan: Domain 1 — Auth & Triage

## Overview

Implement the two kiosk screens (KioskLogin + KioskTriage) and all supporting backend infrastructure for customer authentication, proactive CBS diagnosis, QR handoff, and the governance audit trail. Implementation is ordered by dependency wave so each step builds on proven, tested foundations.

## Tasks

- [ ] 1. Wave 1 — Foundation: DB migration verification, Redis client, React scaffold
  - [ ] 1.1 Verify and extend DB migrations for Domain 1 tables
    - Confirm `transactions` table exists with `account_id`, `amount`, `error_code`, `created_at` columns as defined in `001_initial_schema.sql`
    - Confirm `audit_logs` table exists with `event_type`, `payload_snapshot`, `actor_id`, `created_at` columns
    - Add `email VARCHAR(255) UNIQUE NOT NULL` column to `accounts` table via a new migration `002_accounts_add_email.sql` if not present
    - Create `backend/src/db/migrations/002_accounts_add_email.sql`
    - _Requirements: 2.1, 2.5, 9.1_

  - [~] 1.2 Implement `redisClient.js` — Upstash REST client wrapper
    - Create `backend/src/cache/redisClient.js`
    - Export a configured Upstash Redis REST client using `REDIS_URL` and `REDIS_TOKEN` environment variables
    - Expose `set(key, value, options)`, `get(key)`, `del(key)`, `ttl(key)`, and `incrWithExpiry(key, ex)` wrappers — `incrWithExpiry` uses an INCR+EXPIRE pipeline for atomic counter increment with TTL reset; all other modules must use this wrapper, never the SDK directly
    - _Requirements: 2.4, 3.6, 5.2, 7.3_

  - [~] 1.3 Implement `sessionManager.js` — all OTP, session, and QR token TTL functions
    - Create `backend/src/cache/sessionManager.js`
    - Implement OTP lifecycle: `setOTP(accountId, otp)` with EX 300, `getOTP(accountId)`, `deleteOTP(accountId)`
    - Implement OTP lockout: `incrementOTPAttempts(accountId)` returning new count with EX 300, `lockOTPEntry(accountId)` with EX 300, `isOTPLocked(accountId)` returning boolean
    - Implement kiosk session: `createKioskSession(accountId, jti)` with EX 120, `getKioskSession(jti)` returning accountId, `deleteKioskSession(jti)`
    - Implement QR token: `createQRToken(token, accountId)` with EX 600, `consumeQRToken(token)` returning accountId then DELeting key atomically
    - Use namespaced Redis keys: `otp:{accountId}`, `otp:attempts:{accountId}`, `otp:locked:{accountId}`, `session:{jti}`, `qr:{token}`
    - _Requirements: 2.4, 3.3, 3.4, 3.6, 5.2, 5.6, 7.3_

  - [ ]* 1.4 Write property tests for sessionManager TTL fidelity and OTP lockout (Properties 1, 2, 3, 7)
    - Create `tests/cache/sessionManager.property.test.js` using fast-check
    - **Property 1: OTP attempt counter increments monotonically until lockout** — generator: random accountId UUIDs, integer N in [1,3]; assert incrementOTPAttempts returns N after N calls, isOTPLocked returns true at N=3 — **Validates: Requirements 3.3, 3.4**
    - **Property 2: Redis TTL fidelity for all ephemeral keys** — generator: random accountId/jti/token strings; assert TTL arguments passed to redisClient SET are exactly 300 / 120 / 600 — **Validates: Requirements 2.4, 3.6, 5.2**
    - **Property 3: QR token is single-use** — generator: random URL-safe base64 tokens, random accountId UUIDs; assert first consumeQRToken returns accountId, second returns null — **Validates: Requirements 5.6**
    - **Property 7: Redis session deletion is the authoritative gate** — generator: random jti UUIDs; assert getKioskSession returns null after deleteKioskSession — **Validates: Requirements 7.3, 7.4**

  - [~] 1.5 Scaffold React Router routes for `/kiosk/login` and `/kiosk/triage`
    - Update `frontend/src/routes/index.jsx` to include `<Route path="/kiosk/login" element={<KioskLogin />} />` and `<Route path="/kiosk/triage" element={<KioskTriage />} />`
    - Create stub `frontend/src/pages/kiosk/KioskLogin.jsx` and `frontend/src/pages/kiosk/KioskTriage.jsx` with placeholder renders
    - Verify React Router navigation between the two routes works before proceeding
    - _Requirements: 1.1, 6.2_

- [ ] 2. Checkpoint — Wave 1 complete
  - Ensure all Wave 1 tests pass. Confirm `redisClient.js` and `sessionManager.js` unit/property tests are green. Ask the user if questions arise before proceeding to backend auth.

- [ ] 3. Wave 2 — Backend Auth: authController, authRoutes, governanceSidecar
  - [~] 3.1 Implement OTP request handler in `authController.js`
    - Create `backend/src/controllers/authController.js`
    - Implement `requestOTP(req, res)`: validate `account_number` is 10 numeric digits; query `accounts` table for matching record; return 404 `ERR_ACCOUNT_NOT_FOUND` if not found
    - Generate cryptographically random 6-digit OTP using `crypto.randomInt(100000, 999999)`
    - Call `sessionManager.setOTP(accountId, otp)` — return 503 `ERR_SESSION_STORE_UNAVAILABLE` if Redis write fails
    - Dispatch authentication email via notification gateway (use `NOTIFICATION_GATEWAY_URL` env var) containing the OTP; return 503 `ERR_OTP_DELIVERY_FAILED` on failure
    - Compute `masked_email` from `accounts.email` (e.g. `j***@example.com`) and return `200 { masked_email }`
    - Emit `OTP_SENT` event to governanceSidecar fire-and-forget after response is sent
    - Enforce ≤ 2000 ms total SLA (Req 2.6)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [~] 3.2 Implement OTP verify handler in `authController.js`
    - Implement `verifyOTP(req, res)`: validate `account_number` and `otp` present; look up accountId from `accounts`; check `isOTPLocked` first — return 401 `ERR_OTP_LOCKED` immediately if locked
    - Call `getOTP(accountId)`: return 401 `ERR_OTP_EXPIRED` if null; compare OTP — on mismatch call `incrementOTPAttempts`, lock at count 3 via `lockOTPEntry`, return 401 `ERR_OTP_INVALID`
    - On match: call `deleteOTP(accountId)`; query `transactions` for `ERR_PAN_MISSING_OVER_50K` records in last 24 hours scoped to `account_id` — build `failed_tx_summary` or null; enforce ≤ 1500 ms SLA on CBS query with graceful degradation to null on timeout
    - Issue signed JWT with `{ sub: accountId, account_number: last4, role: "CUSTOMER", jti: uuidv4(), iat, exp: iat+120 }`
    - Call `createKioskSession(accountId, jti)`; return `200 { jwt, failed_tx_summary }`
    - Emit `AUTH_SUCCESS` event fire-and-forget after response
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 4.1, 4.2, 4.6_

  - [ ]* 3.3 Write unit tests for authController OTP request and verify handlers
    - Create `tests/api/authController.test.js` using Vitest + Supertest with mocked `sessionManager`, `db`, and notification gateway
    - Test: unknown account number returns 404 `ERR_ACCOUNT_NOT_FOUND`
    - Test: Redis write failure on setOTP returns 503
    - Test: email dispatch failure returns 503 `ERR_OTP_DELIVERY_FAILED`
    - Test: 3 consecutive wrong OTPs trigger lockout and return `ERR_OTP_LOCKED`
    - Test: expired OTP (null from Redis) returns `ERR_OTP_EXPIRED`
    - Test: valid OTP returns JWT with `role: "CUSTOMER"` and correct `failed_tx_summary`
    - Test: CBS lookup timeout returns `failed_tx_summary: null` without blocking JWT issuance
    - _Requirements: 2.2, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2_

  - [ ]* 3.4 Write property test for failed transaction diagnosis (Property 4)
    - Create `tests/api/failedTxDiagnosis.property.test.js` using fast-check
    - **Property 4: Failed transaction diagnosis is account-scoped and time-bounded** — generator: random arrays of transaction records with varying account_id, error_code values, and created_at timestamps spanning inside and outside 24h window; assert summary count equals exactly the records satisfying all three filter conditions — **Validates: Requirements 4.1, 4.2**

  - [ ]* 3.5 Write property test for PAN threshold enforcement (Property 5)
    - Create `tests/api/panThreshold.property.test.js` using fast-check
    - **Property 5: PAN threshold rule is a strict Boolean boundary** — generator: random amount values in [0, 200000] including boundaries 50000 and 50001, random pan_linked boolean; assert shouldBlockTransaction returns true iff amount > 50000 AND pan_linked is false — **Validates: Requirements 8.1, 8.2**

  - [~] 3.6 Implement QR token generation endpoint in `authController.js`
    - Implement `generateQRToken(req, res)`: validate Bearer JWT via RBAC middleware (role `CUSTOMER`); verify `getKioskSession(jti)` is present — return 401 `ERR_SESSION_EXPIRED` if absent
    - Generate URL-safe base64 token from `crypto.randomBytes(32)`
    - Call `createQRToken(token, accountId)`; compute `deep_link_url` as `https://${process.env.DOMAIN}/mobile/${token}`; return `200 { qr_token, deep_link_url }`
    - Emit `QR_TOKEN_GENERATED` event fire-and-forget
    - _Requirements: 5.1, 5.2, 5.3, 5.5_

  - [~] 3.7 Implement session validate and DELETE session endpoints in `authController.js`
    - Implement `validateSession(req, res)`: extract jti from JWT; call `getKioskSession(jti)` — return `200 { valid: true }` if present, `401 ERR_SESSION_EXPIRED` if null
    - Implement `deleteSession(req, res)`: extract jti; call `deleteKioskSession(jti)`; emit `SESSION_EXPIRED` event with reason (`QR_TIMEOUT` | `SESSION_TIMEOUT` | `MANUAL_NAVIGATE`) fire-and-forget; return `204 No Content`
    - _Requirements: 6.4, 6.5, 7.1, 7.2, 7.4_

  - [~] 3.8 Wire all routes in `authRoutes.js` with RBAC middleware
    - Create `backend/src/routes/authRoutes.js`
    - Mount `POST /api/auth/otp/request` — `requestOTP` (public, no auth)
    - Mount `POST /api/auth/otp/verify` — `verifyOTP` (public, no auth)
    - Mount `POST /api/auth/qr/generate` — `generateQRToken` (RBAC: `CUSTOMER`)
    - Mount `GET /api/auth/session/validate` — `validateSession` (RBAC: `CUSTOMER`)
    - Mount `DELETE /api/auth/session` — `deleteSession` (RBAC: `CUSTOMER`)
    - Create/update `backend/src/middleware/rbac.js` to validate JWT signature and role claim; reject with 401 if Redis session is absent
    - Register `authRoutes` in the main Express app entry point
    - _Requirements: 3.2, 7.4_

  - [~] 3.9 Implement `governanceSidecar.js` — PII redaction and audit_logs insert with retry
    - Create `backend/src/ai/governanceSidecar.js`
    - Implement `redactPAN(payload)`: deep-clone payload object; replace all strings matching `/[A-Z]{5}\d{4}[A-Z]/g` with `"XXXXX-1234-X"` at arbitrary nesting depth
    - Implement `redactAccountNumber(payload)`: replace all 10-digit numeric strings with their last 4 digits
    - Implement `insertAuditLog(record)`: INSERT into `audit_logs`; on failure retry up to 3 times with exponential backoff (100 ms, 200 ms, 400 ms); after all retries exhausted write to application error log — never throw or reject
    - Implement `emitAuthEvent(eventType, payload)`: deep-clone, redact PAN, redact account numbers, then call `insertAuditLog` — entire function is fire-and-forget (returns void, does not await from call-site)
    - Must complete redaction + insert within 500 ms SLA target (Req 9.4)
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [ ]* 3.10 Write property tests for governanceSidecar PII redaction and audit log insertion (Properties 6, 8)
    - Create `tests/api/governanceSidecar.property.test.js` using fast-check
    - **Property 6: Audit log payload is free of all unmasked PII** — generator: random nested payload objects containing PAN-like strings matching `[A-Z]{5}\d{4}[A-Z]` and 10-digit account number strings at arbitrary depths; assert after redactPayload, JSON.stringify(result) contains no unmasked PAN regex matches and no 10-digit numeric strings — **Validates: Requirements 9.2, 9.3**
    - **Property 8: Every auth state transition produces exactly one audit log entry** — generator: random valid AuditEventType values drawn from the full enum, random actor UUIDs and payload objects; assert emitAuthEvent results in exactly one mock INSERT call — **Validates: Requirements 9.1**

- [ ] 4. Checkpoint — Wave 2 complete
  - Ensure all Wave 2 tests pass. Confirm OTP request/verify/QR/session endpoints respond correctly via Supertest. Confirm governanceSidecar redaction properties are green. Ask the user if questions arise.

- [ ] 5. Wave 3 — Frontend: KioskLogin.jsx and KioskTriage.jsx
  - [~] 5.1 Implement `KioskLogin.jsx` — numeric keypad, masked digit display, OTP phase, error states
    - Replace stub with full implementation in `frontend/src/pages/kiosk/KioskLogin.jsx`
    - Render Neo-Bento page layout: `bg-[#e8ecf2]` canvas, `grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 p-6`
    - Render numeric keypad with digits 0–9, backspace, and clear keys as extruded Neo-Bento buttons: `shadow-[8px_8px_16px_#cbced1,-8px_-8px_16px_#ffffff]` resting, `shadow-[inset_4px_4px_8px_#cbced1,inset_-4px_-4px_8px_#ffffff]` active; `focus-visible:ring-2 focus-visible:ring-blue-600` on all keys
    - Render masked inset display well: `shadow-[inset_4px_4px_8px_#cbced1,inset_-4px_-4px_8px_#ffffff] rounded-2xl`; each digit shows as typed for 500 ms then replaces with bullet `•` using `maskDigitAfterDelay(index)` + `setTimeout`
    - `onKeyPress` handler: only allow digits 0–9; silently ignore any non-numeric character; reject when `accountNumber.length >= 10`
    - Enable "Send OTP" CTA button only when `accountNumber.length === 10`; CTA styled as primary: `bg-blue-600 text-white shadow-[0_8px_16px_rgba(37,99,235,0.3)]`
    - Implement OTP phase: after "Send OTP" success, switch to 6-digit OTP input with same masked-digit behaviour; show `masked_email` confirmation string returned from API
    - Display error states inline: `ERR_ACCOUNT_NOT_FOUND`, `ERR_OTP_INVALID` (with remaining attempts), `ERR_OTP_LOCKED` (disable input 300 s), `ERR_OTP_EXPIRED` (return to account phase)
    - On successful OTP verify: store JWT in `sessionStorage`, navigate to `/kiosk/triage` with React Router `state: { jwt, failedTxSummary }`
    - Use `#1e293b` primary text, `#64748b` secondary text throughout; minimum 4.5:1 contrast
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 3.1, 3.2, 3.3, 3.4, 3.5, 10.1, 10.4, 10.6_

  - [ ]* 5.2 Write React Testing Library component tests for KioskLogin
    - Create `tests/frontend/KioskLogin.test.jsx` using React Testing Library + Vitest
    - Test: non-numeric key press is silently ignored — account number state unchanged (Req 1.4)
    - Test: "Send OTP" button disabled when accountNumber.length < 10, enabled at exactly 10 (Req 1.3)
    - Test: digit is masked after 500 ms using fake timers (Req 1.2)
    - Test: clear key resets account number to empty (Req 1.5)
    - Test: `ERR_OTP_LOCKED` renders locked message and disables OTP input (Req 3.4)
    - Test: successful OTP verify stores JWT in sessionStorage and navigates to /kiosk/triage (Req 3.2)

  - [ ]* 5.3 Write property test for numeric keypad input rejection (Property 9)
    - Create `tests/frontend/kioskLoginKeypad.property.test.js` using fast-check
    - **Property 9: Numeric keypad rejects all non-numeric input without side effects** — generator: random strings containing at least one non-numeric character (letters, symbols, punctuation, unicode); assert after processing through onKeyPress handler the accountNumber state is unchanged in length and contains no non-numeric characters — **Validates: Requirements 1.4**

  - [~] 5.4 Implement `KioskTriage.jsx` — proactive diagnosis card, Voice Visualiser, QR canvas hero cell, 45-second countdown, session validation loop, auto-reset
    - Replace stub with full implementation in `frontend/src/pages/kiosk/KioskTriage.jsx`
    - On mount: read `location.state.jwt` and `location.state.failedTxSummary` from React Router; if JWT is absent, immediately redirect to `/kiosk/login`
    - On mount: POST to `/api/auth/qr/generate` with Bearer JWT; store returned `qr_token` and `deep_link_url` in state; render QR code canvas using `qrcode` library encoding the deep link URL
    - Render Neo-Bento grid layout; QR canvas as hero cell: `col-span-1 md:col-span-2 lg:col-span-2 row-span-2 bg-[#e8ecf2] rounded-3xl shadow-[8px_8px_16px_#cbced1,-8px_-8px_16px_#ffffff] p-8`
    - Conditionally render proactive diagnosis Bento card when `failedTxSummary` is non-null: display blocked amount, most recent date, explanation of `ERR_PAN_MISSING_OVER_50K`; render general welcome cell when null
    - Render Voice Visualiser animated waveform Bento cell; set `voiceActive: true` when TTS is playing; animate bars using CSS when active (Req 4.4)
    - Render countdown timer Bento cell: start at 45, decrement every second via `setInterval`; render value in `text-[#2563eb] font-bold` when countdown ≤ 10, `text-[#1e293b]` when > 10 (Req 10.5)
    - `useEffect` session validation loop on every render cycle: call `GET /api/auth/session/validate`; on 401 `ERR_SESSION_EXPIRED` call `resetKiosk()` immediately (Req 7.1, 7.2)
    - `resetKiosk()`: clear all state, `sessionStorage.removeItem('kiosk_jwt')`, call `DELETE /api/auth/session` with reset reason, navigate to `/kiosk/login`
    - Register `beforeunload` and React Router `useBlocker` / navigation listener to trigger `resetKiosk()` on manual navigate away (Req 6.6)
    - Grid spacing `gap-6` or `gap-8`; all interactive elements with `focus-visible:ring-2 focus-visible:ring-blue-600`
    - _Requirements: 4.3, 4.4, 4.5, 5.4, 6.1, 6.2, 6.3, 6.4, 6.6, 7.1, 7.2, 10.2, 10.3, 10.4, 10.5, 10.6_

  - [ ]* 5.5 Write React Testing Library component tests for KioskTriage
    - Create `tests/frontend/KioskTriage.test.jsx` using React Testing Library + Vitest
    - Test: proactive diagnosis card renders when failedTxSummary is non-null (Req 4.3)
    - Test: general welcome screen renders when failedTxSummary is null (Req 4.5)
    - Test: countdown timer renders in #2563eb / text-blue-600 when value ≤ 10 (Req 10.5)
    - Test: navigate to /kiosk/login when countdown reaches 0 (Req 6.2)
    - Test: session validate returns 401 ERR_SESSION_EXPIRED — immediate redirect to /kiosk/login (Req 7.2)
    - Test: QR canvas renders when qr_token is present in state (Req 5.4)

  - [ ]* 5.6 Write property test for countdown timer accent color (Property 10)
    - Create `tests/frontend/countdownAccent.property.test.js` using fast-check
    - **Property 10: Countdown timer threshold drives accent color** — generator: integer countdown values in range [0, 45]; assert rendered countdown element has text-blue-600 / #2563eb class iff countdown <= 10, uses standard text-[#1e293b] for all values > 10 — **Validates: Requirements 10.5**

- [ ] 6. Checkpoint — Wave 3 complete
  - Ensure all Wave 3 component tests pass. Confirm KioskLogin and KioskTriage render correctly with mocked API responses. Ask the user if questions arise before proceeding to integration tests.

- [ ] 7. Wave 4 — Tests: integration and E2E
  - [~] 7.1 Write unit tests for `governanceSidecar.js` redaction and retry logic
    - Create `tests/api/governanceSidecar.unit.test.js` using Vitest with mocked Supabase client
    - Test: raw PAN string "ABCDE1234F" in payload is masked to "XXXXX-1234-X" in payload_snapshot
    - Test: full 10-digit account number in payload is masked to last 4 digits
    - Test: nested payload objects have all PII redacted at arbitrary depth
    - Test: insertAuditLog retries exactly 3 times on failure with exponential backoff (100 ms, 200 ms, 400 ms) using fake timers
    - Test: primary response is not blocked when audit log insert fails all retries
    - _Requirements: 9.2, 9.3, 9.4, 9.5_

  - [~] 7.2 Write unit tests for `sessionManager.js` boundary cases
    - Create `tests/cache/sessionManager.unit.test.js` using Vitest with mock redisClient
    - Test: consumeQRToken second call returns null (single-use)
    - Test: setOTP passes EX 300 to redisClient.set
    - Test: createKioskSession passes EX 120 to redisClient.set
    - Test: createQRToken passes EX 600 to redisClient.set
    - Test: isOTPLocked returns false when no lock key exists, true when lock sentinel "1" is present
    - _Requirements: 2.4, 3.6, 5.2, 5.6_

  - [~] 7.3 Write E2E integration tests covering all critical paths
    - Create `tests/e2e/domain1Auth.e2e.test.js` using Vitest + Supertest against a locally running Express app with Upstash test environment and Supabase staging database
    - Happy path: seed valid account with email — POST /api/auth/otp/request — POST /api/auth/otp/verify with correct OTP — POST /api/auth/qr/generate — GET /api/auth/session/validate returns 200 — DELETE /api/auth/session — GET /api/auth/session/validate returns 401
    - Lockout path: POST /api/auth/otp/verify with wrong OTP 3 times — third response is ERR_OTP_LOCKED — fourth attempt with correct OTP still returns ERR_OTP_LOCKED
    - Session expiry path: issue JWT — manually delete session:{jti} in Redis — GET /api/auth/session/validate returns 401 ERR_SESSION_EXPIRED
    - Proactive diagnosis path: seed account with ERR_PAN_MISSING_OVER_50K transaction within 24 h and one outside 24 h — verify failed_tx_summary.count equals 1 (only the in-window record)
    - Audit trail path: complete full auth flow — query audit_logs for OTP_SENT, AUTH_SUCCESS, QR_TOKEN_GENERATED, SESSION_EXPIRED rows — verify all payload_snapshots contain no unmasked PAN or full account numbers
    - _Requirements: 2.1, 3.1, 3.4, 4.1, 4.2, 6.4, 7.4, 9.1, 9.2, 9.3_

- [ ] 8. Final Checkpoint — All waves complete
  - Ensure all tests pass across `tests/api`, `tests/cache`, `tests/frontend`, and `tests/e2e`. Review audit_logs entries for correct PII masking. Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP iteration
- Each task references specific requirement numbers for full traceability back to the spec
- Property-based tests use **fast-check** with a minimum of 100 iterations per property
- Component tests use **React Testing Library + Vitest**; use `vi.useFakeTimers()` for any time-dependent assertions
- All Redis operations must route through `redisClient.js` — never import the Upstash SDK directly in controllers or session manager
- The governanceSidecar is always called **fire-and-forget** after the primary `res.json()` — never `await` it on the critical path
- JWT is stored in `sessionStorage` only (never `localStorage`) and cleared on every kiosk reset
- OTP lockout check happens **before** OTP comparison to prevent timing-based enumeration attacks
