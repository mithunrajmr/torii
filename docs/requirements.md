# Requirements Specification: Autonomous Branch Operations & Compliance Engine

## 1. System Overview
The Autonomous Branch Operations & Compliance Engine is an enterprise-grade banking kiosk and mobile triage system. It intercepts routine customer compliance blocks (such as unlinked PAN cards) at the branch kiosk, transfers document collection to the customer's mobile smartphone via a secure QR code, and executes an AI agent swarm to prepare pre-verified data for a 1-click Human-in-the-Loop (HITL) teller approval.

---

## 2. Feature Requirements (EARS Notation)

### REQ-01: Proactive Failure Diagnosis & Kiosk Auth
* **EARS Syntax:** When a customer successfully submits their Account Number and OTP at the Kiosk, the system shall query the core transaction ledger for failed transactions occurring within the last 24 hours.
* **Acceptance Criteria:**
  * **Given** an authenticated customer at the kiosk with a transaction failed due to error `ERR_PAN_MISSING_OVER_50K` in the last 24 hours,
  * **When** the kiosk triage screen loads,
  * **Then** the system shall generate a synthesized voice greeting explaining the failure and present an option to fix it immediately via mobile handoff.

### REQ-02: Secure QR Mobile Handoff
* **EARS Syntax:** Where the customer selects the option to resolve the issue via mobile, the system shall generate a time-limited, encrypted session token stored in Redis and render a corresponding QR code on the kiosk display.
* **Acceptance Criteria:**
  * **Given** an active kiosk session displaying a remediation QR code,
  * **When** 45 seconds elapse from the moment of generation,
  * **Then** the kiosk shall automatically terminate the session, clear local state, and return to the idle home screen.

### REQ-03: Multimodal Document OCR & Retry Loop
* **EARS Syntax:** When a customer uploads an image file via the mobile web application, the Vision Agent (IBM Granite 3.2 Vision) shall extract identity metadata (`name`, `pan_number`) and evaluate image clarity.
* **Acceptance Criteria:**
  * **Given** a uploaded PAN card image with an AI clarity score below 0.80,
  * **When** the extraction pipeline completes,
  * **Then** the system shall return an error state (`RETAKE_IMAGE`) to the mobile client without creating a teller ticket.
  * **Given** 3 consecutive failed upload attempts by the same session,
  * **When** the 3rd upload fails,
  * **Then** the system shall bypass OCR, upload the raw image to storage, and generate a `PENDING_MANUAL_REVIEW` ticket for the teller.

### REQ-04: Parallel Agent Swarm Execution
* **EARS Syntax:** While the Vision Agent processes the uploaded document, the system shall concurrently execute the Watchdog Agent (AML Structuring Check) and the Advisor Agent (Personalized Cross-Sell) in parallel threads.
* **Acceptance Criteria:**
  * **Given** a document upload with an OCR name match score greater than 0.80,
  * **When** the Watchdog Agent returns an AML structuring flag (`isSuspicious: true`),
  * **Then** the system shall create a teller ticket flagged with an `AML_RISK` badge and disable standard automated approval routing.

### REQ-05: HITL Teller Verification & Queue Management
* **EARS Syntax:** When an authenticated Bank Teller opens a pending ticket on the dashboard, the system shall generate a temporary 5-minute signed URL from Supabase Storage and display the raw document alongside the AI-extracted JSON.
* **Acceptance Criteria:**
  * **Given** a teller reviewing a clean `PENDING` ticket,
  * **When** the teller clicks "Approve",
  * **Then** the system shall update the core database (`pan_linked = true`), update ticket status to `APPROVED`, log the actor ID, and push a real-time status update to the customer's mobile polling client.

### REQ-06: Regulatory Governance Sidecar
* **EARS Syntax:** Whenever a system state transition occurs across the AI swarm or teller dashboard, the Regulator Agent shall redact personally identifiable information (PII) and append an immutable log entry to the audit database.
* **Acceptance Criteria:**
  * **Given** an AI extraction event or teller rejection action,
  * **When** the event payload is formatted,
  * **Then** the system shall mask all PAN numeric strings to `XXXXX-1234-X` before committing the payload to the PostgreSQL `audit_logs` table.
* **Audited Event Types:** `OTP_SENT`, `OTP_VERIFIED`, `OTP_FAILED`, `OTP_LOCKED`, `SESSION_CREATED`, `SESSION_EXPIRED`, `QR_TOKEN_GENERATED`, `TX_BLOCKED_PAN_MISSING`, `AUTH_SUCCESS`, `DOCUMENT_UPLOADED`, `TICKET_APPROVED`, `TICKET_REJECTED`