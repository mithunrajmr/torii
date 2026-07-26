# Master Specification: Autonomous Branch Operations & Compliance Engine (v2.0)

## 1. Executive Summary
*   **Project Name:** Autonomous Branch Operations & Compliance Engine
*   **Vision:** Eliminate retail branch queues by transforming bank kiosks into proactive, agentic triage engines that resolve compliance failures (e.g., missing PAN/KYC) via secure mobile handoffs and 1-click Human-in-the-Loop (HITL) approvals.
*   **Goals:** Reduce kiosk interaction time to < 45 seconds; reduce teller verification time by 90%; enforce strict regulatory compliance via AI governance sidecars.
*   **Non-goals:** Fully automated ledger writes without human approval; replacing teller jobs entirely; handling complex loan origination at the kiosk.
*   **Target Users:** Retail bank customers (Kiosk/Mobile); Branch Tellers (Dashboard); Auditors/Compliance Teams (Audit Logs).
*   **Success Criteria:** Valid End-to-End flow from Kiosk auth to Teller approval; successful Granite Vision OCR extraction; demonstrable watsonx.governance audit trail; secure signed-URL image handling; zero PII data leaks in LLM calls.

---

## 2. Business Requirements
### Functional Requirements
*   Customers authenticate via Account Number and Email OTP (simulated fast-delivery).
*   System proactively fetches the most recent failed transaction within the last 24 hours.
*   System hands off document collection to user's mobile device via temporary QR code.
*   Mobile app uses IBM Granite Vision to OCR PAN cards, flag blurry images, and handle retries.
*   Teller dashboard displays pre-verified OCR data vs. Raw Image for 1-click approval or rejection.
### Non-Functional Requirements
*   **Latency:** Core Orchestrator routing < 1s. OCR extraction < 3s.
*   **Security:** Kiosk sessions auto-expire in 120s overall, but triage QR screen auto-redirects in 45s. QR mobile sessions expire in 10 minutes.
### Constraints & Assumptions
*   Built entirely on free-tier services (Node.js, React, Supabase, Upstash Redis, Resend).
*   Free-tier compute cold-starts (e.g., Render) will be mitigated using cron-job keep-alives (UptimeRobot).
### Acceptance Criteria
*   The system successfully extracts Name and PAN from a mobile photo, accurately scores name similarity, securely stores the image via Supabase Object Storage, and completes the HITL loop.

---

## 3. User Roles
| Role | Responsibilities | Permissions | Allowed Actions | Restricted Actions |
| :--- | :--- | :--- | :--- | :--- |
| **Customer** | Authenticate, diagnose issue, upload docs | Read-only (Self) | Upload PAN, view proactive errors | Cannot approve transactions, cannot view logs |
| **Teller** | Verify AI output, approve/reject tickets | Read/Write (Queue) | Approve/Reject tickets, Escalate AML | Cannot alter audit logs, cannot change AI logic |
| **Auditor** | Review AI decision-making | Read-only (Audit) | View AI confidence scores, view audit logs | Cannot approve tickets, cannot access Kiosk UI |

---

## 4. Complete User Journeys

### Journey 1: Proactive KYC Resolution
*   **Entry:** Kiosk `/kiosk` screen.
*   **User Action:** Enters Account Number. Submits OTP.
*   **Backend:** Queries `transactions` table. Finds most recent `ERR_PAN_MISSING_OVER_50K`. (If 0 found, plays generic greeting).
*   **AI Action:** Generates TTS greeting: "Your 50k deposit failed due to missing PAN. Scan QR to fix."
*   **User Action:** Scans QR code. Kiosk QR screen holds for 45s, then auto-resets.
*   **Exit:** Kiosk returns to idle state. User continues on mobile.

### Journey 2: Mobile Document Upload & Swarm Execution
*   **Entry:** Mobile `/mobile/:session_token`.
*   **User Action:** Takes photo of PAN card and clicks Upload.
*   **Backend:** Validates token in Redis. Uploads image to Supabase Storage. Triggers AI Swarm.
*   **AI Action:**
    *   *Vision Agent:* OCRs document.
    *   *Watchdog Agent:* Checks AML history.
    *   *Advisor Agent:* Generates cross-sell offer.
*   **Validations:** 
    *   If Vision confidence < 80%, UI returns `RETAKE_IMAGE`. (After 3 failed attempts, system generates a `PENDING_MANUAL_REVIEW` ticket, skipping OCR).
    *   If name match < 50%, UI returns `MISMATCH_ERROR` (Hard reject).
    *   If name match 50%-79%, creates `PENDING` ticket flagged `NAME_MISMATCH`.
*   **Success State:** DB Ticket created. Mobile displays Cross-sell offer and transitions to a polling waiting screen.
*   **Exit:** Mobile waits for Teller action.

### Journey 3: Teller HITL Approval / Rejection
*   **Entry:** Teller Dashboard `/teller` (Authenticated via Staff JWT).
*   **User Action:** Clicks on `PENDING` ticket.
*   **Backend:** Fetches DB record and generates a 5-minute Signed URL for the PAN image.
*   **User Action:** Teller compares JSON to Image. Clicks "Approve" (or "Reject" with reason).
*   *Edge Case:* If ticket is flagged `AML_RISK`, the "Approve" button is disabled; Teller must click "Escalate to Compliance".
*   **Backend:** Updates `accounts.pan_number`, sets `pan_linked = true`. Updates ticket status. Notifies Mobile App via polling. Sends email.
*   **Exit:** Ticket removed from Queue. Mobile UI updates to "Approved".

---

## 5. Screen-by-Screen Specification

### 1. Kiosk Login (`/kiosk/login`)
*   **Purpose:** Authenticate user.
*   **Layout:** Centered numeric keypad, account input field.
*   **Inputs:** `account_number` (10 digits), `otp` (6 digits).
*   **Timeout:** Resets after 120s of total inactivity across any step.

### 2. Kiosk Triage (`/kiosk/triage`)
*   **Purpose:** Voice/TTS interaction & QR Handoff.
*   **Components:** QR Code Canvas, "Print Ticket" fallback button.
*   **Navigation:** Auto-redirects to `/kiosk/login` exactly 45 seconds after QR generation.

### 3. Mobile Upload (`/mobile/:session_token`)
*   **Purpose:** Secure document capture and wait-state polling.
*   **Components:** Camera viewfinder, "Upload" button, Polling Status Indicator.
*   **Error States:** "Image Blurry - Retake" (Max 3), "Name Mismatch - Visit Teller", "Session Expired".
*   **Success States:** Displays Cross-Sell Offer while polling `GET /api/mobile/status/:session_token` every 5 seconds. Updates to "Complete" when Teller approves.

### 4. Teller Dashboard (`/teller`)
*   **Purpose:** HITL Queue Management.
*   **Components:** TicketCard, SecureImage display (via Signed URL), ApprovalButtonGroup (Approve, Reject, Escalate).
*   **Validation:** Action buttons require a dropdown selection for Rejection (e.g., "Blurry", "Mismatched ID"). "Approve" disabled if `aml_flagged == true`.

---

## 6. Component Specification
*   `QRCodeGenerator`: Props `{ payload: string, timeout: number }`. State: `timeRemaining`. Re-renders countdown.
*   `SecureImageDisplay`: Props `{ ticketId: string }`. Fetches signed URL from backend on mount.
*   `StatusPoller`: Props `{ sessionToken: string }`. Polls backend, displays Teller decision in real-time.

---

## 7. Complete Backend Design

### API Endpoints
| Method | Endpoint | Request | Response | Logic |
| :--- | :--- | :--- | :--- | :--- |
| POST | `/api/auth/otp` | `{ account: string }` | `200 OK` | Generate OTP, Save to Redis, Send Email. |
| POST | `/api/auth/verify` | `{ account, otp }` | `{ jwt, context }` | Validate OTP. Fetch most recent CBS tx. |
| POST | `/api/auth/staff-login`| `{ username, password }`| `{ staff_jwt, role }`| Authenticate Teller/Auditor. Return RBAC token. |
| POST | `/api/mobile/qr` | `Headers: Bearer` | `{ qr_url }` | Generate `session_token`, save to Redis (TTL 600s). |
| POST | `/api/mobile/upload` | `FormData(file, token)`| `{ status, offer }` | Upload to Supabase Storage. Trigger Swarm. Create Ticket. |
| GET | `/api/mobile/status`| `Headers: Bearer` | `{ status }` | Mobile polling endpoint to check Teller action. |
| GET | `/api/teller/tickets` | `Headers: Staff JWT`| `[ { ticket } ]` | Fetch tickets WHERE `status = PENDING`. |
| GET | `/api/teller/media/:id`| `Headers: Staff JWT`| `{ signed_url }` | Generate 5-minute signed Supabase Storage URL. |
| POST | `/api/teller/approve`| `{ ticket_id }` | `200 OK` | Update CBS DB. Log Actor ID. Trigger Email. |
| POST | `/api/teller/reject` | `{ ticket_id, reason }`| `200 OK` | Update Ticket to `REJECTED`. Log Actor ID & Reason. |

---

## 8. Database Design (PostgreSQL)

### `accounts`
*   `id` (UUID, PK)
*   `user_id` (UUID, FK -> users.id)
*   `account_number` (VARCHAR(10), UNIQUE)
*   `balance` (DECIMAL)
*   `pan_linked` (BOOLEAN, Default: FALSE)
*   `pan_number` (VARCHAR(10), NULL) *(Added for OCR extraction storage)*

### `teller_tickets`
*   `id` (UUID, PK)
*   `account_id` (UUID, FK -> accounts.id)
*   `status` (ENUM: `PENDING`, `PENDING_MANUAL_REVIEW`, `APPROVED`, `REJECTED`)
*   `document_path` (VARCHAR) *(Supabase Bucket Path)*
*   `ocr_data` (JSONB)
*   `ai_confidence` (FLOAT)
*   `name_mismatch_score` (FLOAT) *(Added for granular HITL review)*
*   `aml_flagged` (BOOLEAN, Default: FALSE)
*   `reviewed_by` (UUID, FK -> users.id, NULL) *(Added for attribution)*
*   `rejection_reason` (VARCHAR, NULL) *(Added for rejection context)*
*   `created_at` (TIMESTAMP)

### `audit_logs`
*   `id` (UUID, PK)
*   `event_type` (VARCHAR)
*   `payload_snapshot` (JSONB) *(Redacted PII)*
*   `actor_id` (UUID, NULL) *(Added to track Teller/System actions)*
*   `created_at` (TIMESTAMP)

---

## 9. AI Architecture

### Swarm Pipeline & Redaction Separation
*   *Conflict Resolution:* PII Redaction (`Regulator_In`) applies **only** to unstructured Voice/Text inputs from the Kiosk. Image uploads from Mobile bypass `Regulator_In` and go directly to Granite Vision to ensure DB fuzzy matching works. PII is redacted during the final Audit DB write (`Regulator_Out`).

| Agent | Model | Input | Output / Action |
| :--- | :--- | :--- | :--- |
| **Regulator_In** | Regex / Granite | Kiosk Voice/Text | Strips PII for Orchestrator routing. |
| **Vision (OCR)** | Granite 3.2 | Image File | Extracts `name`, `pan`. Scores clarity. |
| **Watchdog** | Granite / DB Logic | Tx History | Flags AML structuring (`{ isSuspicious }`). |
| **Regulator_Out** | watsonx.gov / Regex| System Event Data| Redacts PII, writes to `audit_logs`. |

---

## 10. Workflow Diagrams

```mermaid
flowchart TD
    Customer[Customer] --> KioskLogin[Kiosk: Login & OTP]
    KioskLogin --> B_Auth[Auth Gateway]
    B_Auth --> CheckTx{Recent Failed Tx?}
    
    CheckTx -- Yes --> KioskQR[Show QR (45s TTL)]
    CheckTx -- No/Multiple --> KioskVoice[Voice Triage]
    
    KioskQR --> Mobile[Mobile Web App]
    Mobile --> Upload[Upload Document]
    Upload --> Supabase[(Supabase Storage)]
    
    Upload --> Swarm{Parallel AI Swarm}
    Swarm --> Vision[Vision: OCR & Fuzzy Match]
    Swarm --> Watchdog[Watchdog: AML Check]
    
    Vision -- Confidence < 80% --> Retry[Mobile: Retake Image]
    Retry -- > 3 Attempts --> ManualTicket[Create PENDING_MANUAL Ticket]
    
    Vision -- Confidence >= 80% --> Sync[Backend Synthesizer]
    Watchdog --> Sync
    
    Sync --> TellerDB[(Teller Tickets DB)]
    TellerDB --> Dashboard[Teller Dashboard]
    
    Dashboard --> TellerAction{Review Action}
    TellerAction -- Approve --> LinkPAN[Update DB: PAN Linked]
    TellerAction -- Reject --> RejectLog[Log Rejection Reason]
    TellerAction -- Escalate AML --> Compliance[Flag to Compliance]
```

---

## 11. Security
*   **Authentication:** 
    *   Kiosk: Short-lived JWT via Email OTP.
    *   Internal: Staff JWT with RBAC middleware (`role === 'TELLER'`).
*   **Media Security:** Uploaded images are stored privately in Supabase Storage. Kiosk/Mobile clients cannot access them. Tellers fetch temporary (5-minute) Signed URLs via authenticated `GET /api/teller/media/:id`.
*   **Data Masking:** Final DB audit writes sanitize PAN strings to `XXXXX-1234-X`.

---

## 12. Notifications
*   **Mobile Web Polling:** User sees real-time approval status via polling rather than waiting for an email.
*   **Rejection Email:** If Teller rejects, system emails user: "Your document was rejected because: [Reason]. Please visit the branch."

---

## 13. Integrations & Infrastructure
*   **Keep-Alive Strategy:** To prevent Render.com cold starts, an external cron service (UptimeRobot) pings `/api/health` every 5 minutes.
*   **IBM watsonx.ai API:** Parallelized calls limited to 3 concurrent connections to respect free-tier rate limits, yielding a < 3s SLA.

---

## 14. Error Handling
*   **Redis Failure:** System detects Redis disconnect and fails over to PostgreSQL temporary session tables (bypassing in-memory maps to support horizontal scaling).
*   **OCR Total Failure:** If Granite Vision times out entirely, system defaults to `PENDING_MANUAL_REVIEW`, passing the raw image to the Teller.

---

## 15. Edge Cases
1.  **Multiple Failed Transactions:** Backend prioritizes the *most recent* failed transaction. If multiple KYC failures exist, Kiosk defaults to Voice Routing.
2.  **AML Flag Override:** Tellers are structurally blocked from approving an `AML_FLAGGED` ticket. The UI replaces "Approve" with "Escalate to Compliance Manager".
3.  **Name Mismatch Scoring Thresholds:**
    *   `< 50%`: Hard reject on mobile frontend.
    *   `50% - 79%`: Accepted, but marked `NAME_MISMATCH` in Teller dashboard.
    *   `>= 80%`: Accepted as clean match.

---

## 16. State Management
*   **Server State:** REST stateless APIs. Supabase handles persistent state. Redis handles ephemeral auth.
*   **Mobile State Disconnect:** Mobile app `StatusPoller` component guarantees the user knows the outcome of the Teller review without relying on kiosk proximity.

---

## 17. Deployment
*   **Infrastructure:** Vercel (Frontend), Render.com (Backend API), Supabase (DB + Storage), Upstash (Redis).
*   **Environment Variables:** `DATABASE_URL`, `REDIS_URL`, `SUPABASE_KEY`, `WATSONX_API_KEY`, `RESEND_API_KEY`, `STAFF_JWT_SECRET`.

---

## 18. Testing Strategy
*   **Unit Tests:** RBAC middleware protection; fuzzy-name string matching thresholds.
*   **Integration Tests:** Supabase signed URL generation; watsonx payload parallelization.
*   **Acceptance Tests (Manual):** End-to-end QR flow demonstrating Mobile polling state updates upon Teller approval.

---

## 19. Development Roadmap (Hackathon Timeline)
*   **Milestone 1 (Hours 1-4):** DB Setup (Supabase/Redis/Storage) + Node.js boilerplate + Kiosk UI.
*   **Milestone 2 (Hours 4-8):** Auth Gateways + Staff JWT setup + Mobile QR polling framework.
*   **Milestone 3 (Hours 8-16):** Swarm Integration (Granite Vision OCR, Watchdog, Regulator_Out).
*   **Milestone 4 (Hours 16-20):** Teller Dashboard UI + Signed URL Image rendering + Approve/Reject logic.
*   **Milestone 5 (Hours 20-24):** End-to-end testing, cold-start mitigation setup, pitch recording.

---

## 20. Final Consistency Audit
*   **Missing Screens:** None.
*   **Orphan APIs/Tables:** Fixed. `POST /api/teller/reject` and Staff Auth implemented. `accounts.pan_number` storage added.
*   **Undefined Workflows:** Fixed. AML override limits, OCR retry thresholds, and timeout mismatches strictly defined.
*   **Unresolved Assumptions:** Fixed. Switched from ephemeral local disk storage to Supabase Object Storage to prevent data loss.