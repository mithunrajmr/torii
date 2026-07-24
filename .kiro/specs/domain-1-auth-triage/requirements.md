# Requirements Document

## Introduction

Domain 1 covers the entry point of the Autonomous Branch Operations & Compliance Engine — the two screens a customer interacts with at the branch kiosk before handing off to their mobile device.

**Kiosk Authentication (`KioskLogin`)** authenticates the customer using a numeric account number and a Redis-backed OTP, then immediately performs a proactive ledger lookup to surface any recent failed transactions (e.g., `ERR_PAN_MISSING_OVER_50K`) before the customer even asks.

**QR Handoff / Triage (`KioskTriage`)** presents the authenticated customer with a synthesised voice greeting explaining their compliance block, generates a time-limited encrypted session token, renders a scannable QR code, and auto-resets the kiosk after 45 seconds of QR display (or 2 minutes total session inactivity) so the next customer is never left waiting.

This domain maps directly to:
- `frontend/src/pages/kiosk/KioskLogin.jsx`
- `frontend/src/pages/kiosk/KioskTriage.jsx`
- `backend/src/controllers/authController.js` / `authRoutes.js`
- `backend/src/cache/sessionManager.js` (OTP TTL 300 s, kiosk session TTL 120 s, QR token TTL 600 s)
- `backend/src/ai/governanceSidecar.js` (PII redaction on all auth events)

---

## Glossary

- **Kiosk_Login**: The `KioskLogin.jsx` page component — the numeric keypad and OTP input screen at the branch kiosk.
- **Kiosk_Triage**: The `KioskTriage.jsx` page component — the voice visualiser, QR canvas, and proactive diagnosis screen.
- **Auth_Controller**: The `authController.js` Node.js controller that validates credentials, issues JWTs, and queries the CBS ledger.
- **Session_Manager**: The `sessionManager.js` cache module that reads and writes all ephemeral state (OTP, kiosk session, QR token) to Upstash Redis.
- **Governance_Sidecar**: The `governanceSidecar.js` middleware that redacts PII and writes immutable entries to `audit_logs` on every auth event.
- **OTP**: A one-time password with a 300-second TTL stored in Redis, dispatched to the email address registered against the customer's account record.
- **Kiosk_Session**: A short-lived JWT and matching Redis record scoped to one authenticated kiosk interaction, with a 120-second TTL.
- **QR_Token**: An encrypted, single-use session token stored in Redis with a 600-second TTL, embedded in the QR code and consumed by the mobile handoff flow.
- **ERR_PAN_MISSING_OVER_50K**: The error code recorded in the `transactions` table when a transaction above ₹50,000 is blocked because the account's `pan_linked` flag is `false`.
- **CBS**: Core Banking System — represented by the `transactions` and `accounts` tables in PostgreSQL via Supabase.
- **RBAC**: Role-Based Access Control enforced via JWT claims; the kiosk flow uses the `CUSTOMER` role.
- **PAN**: Permanent Account Number — the Indian tax identifier whose absence triggers `ERR_PAN_MISSING_OVER_50K`.
- **Neo_Bento_UI**: The Neo-Bento design system governing all frontend components: neumorphic shadows on a `#e8ecf2` canvas, `rounded-2xl` cards, and asymmetric CSS grid layouts.
- **Voice_Visualiser**: The animated waveform element within `KioskTriage` that indicates active AI voice output to the customer.

---

## Requirements

### Requirement 1: Numeric Keypad Account Entry

**User Story:** As a bank customer at the branch kiosk, I want to enter my account number using a touchscreen numeric keypad, so that I can authenticate without needing a physical card or keyboard.

#### Acceptance Criteria

1. THE `Kiosk_Login` SHALL render a numeric keypad with digits 0–9, a backspace key, and a clear key, styled as Neo_Bento_UI inset buttons on the `#e8ecf2` canvas.
2. THE `Kiosk_Login` SHALL display the entered digits in a masked inset well, showing each digit as entered for 500 milliseconds before replacing it with a bullet character (`•`).
3. WHEN the entered account number reaches exactly 10 characters, THE `Kiosk_Login` SHALL activate the "Send OTP" submit control.
4. IF the entered account number contains any non-numeric character, THEN THE `Kiosk_Login` SHALL reject the character and preserve the existing input without displaying an error message.
5. WHEN the customer activates the clear key, THE `Kiosk_Login` SHALL reset the account number input field to an empty state.

---

### Requirement 2: OTP Generation and Delivery

**User Story:** As a bank customer, I want to receive a one-time password at my registered email address, so that I can complete a second factor of authentication at the kiosk.

#### Acceptance Criteria

1. WHEN the customer submits a 10-digit account number, THE `Auth_Controller` SHALL query the `accounts` table for a record matching that account number.
2. IF no record matching the submitted account number exists in the `accounts` table, THEN THE `Auth_Controller` SHALL return error code `ERR_ACCOUNT_NOT_FOUND` to `Kiosk_Login` without generating an OTP.
3. WHEN a matching account record is found, THE `Auth_Controller` SHALL generate a cryptographically random 6-digit numeric OTP.
4. WHEN the OTP is generated, THE `Session_Manager` SHALL store the OTP in Redis under a key scoped to the account number with a TTL of exactly 300 seconds.
5. WHEN the OTP is stored, THE `Auth_Controller` SHALL dispatch an authentication email containing the OTP to the email address registered against the account record.
6. THE `Auth_Controller` SHALL respond to the OTP request within 2000 milliseconds of receiving a valid account number submission.

---

### Requirement 3: OTP Verification and Kiosk Session Issuance

**User Story:** As a bank customer, I want the kiosk to verify my OTP and grant me a secure session, so that my subsequent interaction is authenticated and time-limited.

#### Acceptance Criteria

1. WHEN the customer submits a 6-digit OTP on `Kiosk_Login`, THE `Auth_Controller` SHALL retrieve the stored OTP from Redis using the account-scoped key.
2. IF the submitted OTP matches the stored OTP and the Redis TTL has not expired, THEN THE `Auth_Controller` SHALL issue a signed JWT containing the `account_id`, `account_number`, and `CUSTOMER` role claim.
3. IF the submitted OTP does not match the stored OTP, THEN THE `Auth_Controller` SHALL return error code `ERR_OTP_INVALID` and increment a per-account attempt counter in Redis.
4. IF the per-account attempt counter reaches 3 consecutive failed OTP submissions, THEN THE `Auth_Controller` SHALL lock the account's OTP entry in Redis for 300 seconds and return error code `ERR_OTP_LOCKED`.
5. IF the Redis TTL for the OTP key has expired before submission, THEN THE `Auth_Controller` SHALL return error code `ERR_OTP_EXPIRED`.
6. WHEN the JWT is issued, THE `Session_Manager` SHALL create a kiosk session record in Redis keyed on the JWT `jti` claim with a TTL of exactly 120 seconds.
7. WHEN the JWT is issued, THE `Governance_Sidecar` SHALL write an `AUTH_SUCCESS` event to `audit_logs`, masking the account number to its last 4 digits in the payload.

---

### Requirement 4: Proactive Failed Transaction Diagnosis

**User Story:** As a bank customer who recently had a transaction blocked, I want the kiosk to immediately tell me why it failed and offer a fix, so that I do not need to know which regulation I violated.

#### Acceptance Criteria

1. WHEN authentication succeeds, THE `Auth_Controller` SHALL query the `transactions` table for all records matching the authenticated `account_id` where `error_code = 'ERR_PAN_MISSING_OVER_50K'` and `created_at` is within the last 24 hours.
2. IF one or more matching failed transactions exist, THEN THE `Auth_Controller` SHALL include a `failed_tx_summary` object in the authentication response, containing the count of failures and the most recent `amount` and `created_at` values.
3. WHEN the `Kiosk_Triage` page receives a `failed_tx_summary`, THE `Kiosk_Triage` SHALL display a proactive diagnosis card within the Neo_Bento_UI grid explaining that a transaction above ₹50,000 was blocked due to a missing PAN link.
4. WHEN the proactive diagnosis card is displayed, THE `Voice_Visualiser` SHALL animate to indicate active AI speech, and the system SHALL synthesise and play a voice greeting in the customer's preferred language explaining the `ERR_PAN_MISSING_OVER_50K` failure.
5. IF no `ERR_PAN_MISSING_OVER_50K` transactions exist for the account in the last 24 hours, THEN THE `Kiosk_Triage` SHALL display a general welcome screen without a proactive diagnosis card.
6. THE `Auth_Controller` SHALL complete the CBS ledger lookup query within 1500 milliseconds of receiving the authentication request.

---

### Requirement 5: QR Code Generation for Mobile Handoff

**User Story:** As a bank customer who wants to resolve a PAN linking block, I want to scan a QR code at the kiosk that opens a secure mobile session, so that I can complete document submission on my own phone.

#### Acceptance Criteria

1. WHEN the customer accepts the offer to resolve the compliance block on `Kiosk_Triage`, THE `Auth_Controller` SHALL generate a cryptographically random, single-use `QR_Token`.
2. WHEN the `QR_Token` is generated, THE `Session_Manager` SHALL store the token in Redis keyed on the token value, with the authenticated `account_id` as its payload and a TTL of exactly 600 seconds.
3. WHEN the `QR_Token` is stored, THE `Auth_Controller` SHALL return the token to `Kiosk_Triage` for encoding into the QR code.
4. WHEN the token is received, THE `Kiosk_Triage` SHALL render a QR code canvas in the Neo_Bento_UI hero cell encoding a deep-link URL of the form `https://<domain>/mobile/<token>`.
5. THE `QR_Token` SHALL be encoded as a URL-safe base64 string of at least 32 random bytes.
6. IF the `QR_Token` has already been consumed by a mobile client, THEN THE `Session_Manager` SHALL return a token-not-found response to any subsequent lookup, preventing session replay.

---

### Requirement 6: Kiosk Auto-Reset on QR Display Timeout

**User Story:** As a branch manager, I want the kiosk to automatically reset to its idle state after the QR code display period, so that the next customer cannot see or reuse a previous customer's session.

#### Acceptance Criteria

1. WHEN the QR code canvas is rendered on `Kiosk_Triage`, THE `Kiosk_Triage` SHALL start a 45-second countdown timer displayed visibly to the customer.
2. WHEN the 45-second countdown timer reaches zero, THE `Kiosk_Triage` SHALL clear all local React state, remove the Kiosk JWT from browser storage, and navigate to the `Kiosk_Login` idle screen.
3. WHILE the kiosk session JWT is active, THE `Kiosk_Triage` SHALL automatically reset to the `Kiosk_Login` idle screen if 120 seconds elapse from the time the JWT was issued, regardless of countdown timer state.
4. WHEN the kiosk session resets for any reason, THE `Session_Manager` SHALL delete the kiosk session Redis key associated with the expired JWT `jti` claim.
5. WHEN the kiosk session resets, THE `Governance_Sidecar` SHALL write a `SESSION_EXPIRED` event to `audit_logs` with the masked `account_id` and the reset trigger reason (`QR_TIMEOUT` or `SESSION_TIMEOUT`).
6. IF the customer manually navigates away from `Kiosk_Triage` before the timer expires, THEN THE `Kiosk_Triage` SHALL execute the same state-clearing and Redis-deletion sequence as a timer-expiry reset.

---

### Requirement 7: Kiosk Session Inactivity Enforcement

**User Story:** As a security officer, I want the kiosk to enforce a hard 2-minute session ceiling, so that an abandoned kiosk cannot be exploited by a subsequent visitor.

#### Acceptance Criteria

1. WHILE a kiosk session JWT is present in browser storage, THE `Kiosk_Triage` SHALL validate the JWT against the Redis session record on every page render cycle.
2. IF the Redis session record associated with the JWT `jti` claim is absent or expired, THEN THE `Kiosk_Triage` SHALL immediately clear local state and redirect to `Kiosk_Login`.
3. THE `Session_Manager` SHALL enforce the 120-second TTL on kiosk session records exclusively via Redis expiry — never via in-memory timers in the Node.js process.
4. IF a request carrying a kiosk session JWT arrives at any `Auth_Controller` endpoint after the Redis session TTL has expired, THEN THE `Auth_Controller` SHALL reject the request with HTTP 401 and error code `ERR_SESSION_EXPIRED`.

---

### Requirement 8: PAN Transaction Threshold Enforcement

**User Story:** As a compliance officer, I want the system to record the precise error code for every transaction blocked by the ₹50,000 PAN-linking rule, so that the kiosk diagnosis logic has a reliable signal to act on.

#### Acceptance Criteria

1. WHEN a transaction with an `amount` greater than 50000 is attempted on an account where `pan_linked = false`, THE `Auth_Controller` SHALL record `ERR_PAN_MISSING_OVER_50K` as the `error_code` in the `transactions` table row for that transaction.
2. THE `Auth_Controller` SHALL not record `ERR_PAN_MISSING_OVER_50K` on transactions with an `amount` of 50000 or less, regardless of `pan_linked` status.
3. WHEN an `ERR_PAN_MISSING_OVER_50K` transaction record is created, THE `Governance_Sidecar` SHALL write a `TX_BLOCKED_PAN_MISSING` audit event to `audit_logs`, masking the PAN number (if present) to `XXXXX-1234-X` format.

---

### Requirement 9: Authentication Audit Trail

**User Story:** As a compliance team member, I want every authentication event at the kiosk to produce an immutable, PII-safe audit log entry, so that I can reconstruct the full session timeline during an investigation.

#### Acceptance Criteria

1. WHEN any authentication state transition occurs (OTP sent, OTP verified, OTP failed, session created, session expired, QR token generated), THE `Governance_Sidecar` SHALL append one immutable record to the `audit_logs` table containing `event_type`, `actor_id` (account UUID or `null`), `created_at`, and a `payload_snapshot` JSONB object.
2. THE `Governance_Sidecar` SHALL mask all PAN numeric strings within `payload_snapshot` to the format `XXXXX-1234-X` before committing the record to `audit_logs`.
3. THE `Governance_Sidecar` SHALL mask all full account numbers within `payload_snapshot` to their last 4 digits before committing the record to `audit_logs`.
4. THE `Governance_Sidecar` SHALL complete the redaction and `audit_logs` insert within 500 milliseconds of receiving the event payload.
5. IF the `audit_logs` insert fails, THEN THE `Governance_Sidecar` SHALL retry the insert up to 3 times with exponential backoff before logging the failure to the application error log — the primary authentication response SHALL NOT be blocked by audit log failures.

---

### Requirement 10: Neo-Bento Kiosk UI Fidelity

**User Story:** As a branch design lead, I want both kiosk screens to conform to the Neo-Bento design system, so that the kiosk maintains a consistent, accessible, and visually coherent appearance across all branch deployments.

#### Acceptance Criteria

1. THE `Kiosk_Login` SHALL render all interactive elements (keypad buttons, OTP input well, submit control) using the Neo_Bento_UI shadow tokens: extruded surface `shadow-[8px_8px_16px_#cbced1,-8px_-8px_16px_#ffffff]` for resting state and inset surface `shadow-[inset_4px_4px_8px_#cbced1,inset_-4px_-4px_8px_#ffffff]` for active/pressed state.
2. THE `Kiosk_Triage` SHALL render the QR code canvas as a hero Bento cell spanning `col-span-1 md:col-span-2 lg:col-span-2 row-span-2` within the page grid.
3. THE `Kiosk_Triage` SHALL render the countdown timer and proactive diagnosis card as distinct Bento cells within the same CSS grid, maintaining `gap-6` or `gap-8` spacing.
4. THE `Kiosk_Login` AND `Kiosk_Triage` SHALL maintain a minimum contrast ratio of 4.5:1 between all text content and its background surface, using `#1e293b` for primary text and `#64748b` for secondary text.
5. WHEN the countdown timer cell is displayed, THE `Kiosk_Triage` SHALL render the remaining seconds in a bold, high-contrast typographic style using the accent colour `#2563eb` when 10 or fewer seconds remain.
6. THE `Kiosk_Login` AND `Kiosk_Triage` SHALL expose a `focus-visible:ring-2 focus-visible:ring-blue-600` focus indicator on all interactive elements to support keyboard navigation accessibility.
