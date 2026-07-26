# Requirements: Domain 0 — Mock CBS Sandbox & Data Seeding Engine

## 1. Domain Overview
This domain establishes a standalone developer control plane and simulated banking ledger (`/sandbox`). It allows developers and demo presenters to populate the database with diverse customer personas, inject custom transaction failures, trigger Anti-Money Laundering (AML) transaction velocity patterns, and simulate infrastructure latency to test downstream AI agent resilience.

---

## 2. Feature Requirements (EARS Notation)

### REQ-001: Persona-Based Database Seeding
* **EARS Syntax:** When a developer initiates a seed command for a specific customer persona via the sandbox UI or API, the system shall purge existing conflicting records and insert deterministic account profiles, KYC states, and historical transaction logs into PostgreSQL.
* **Acceptance Criteria:**
  * **Given** the sandbox control panel on `/sandbox`,
  * **When** the user selects the "PAN Blocked Depositor" persona and clicks "Seed Profile",
  * **Then** the system shall create account `1000000001` with `pan_linked: false`, balance `₹1,50,000`, and insert a failed deposit transaction with code `ERR_PAN_MISSING_OVER_50K` timestamped within the last 2 hours.
  * **Given** a request to seed the "AML Smurfer" persona,
  * **When** the seed executes,
  * **Then** the system shall generate account `1000000002` with 4 separate cash deposit transactions of `₹49,000` occurring over the preceding 72 hours.

### REQ-002: Live Ledger Inspection & State Reset
* **EARS Syntax:** While the sandbox dashboard is active, the system shall display a real-time tabular view of all mock accounts and provide a global reset mechanism to restore the database to a clean factory state.
* **Acceptance Criteria:**
  * **Given** an active sandbox session,
  * **When** an account state is modified by an external kiosk or teller interaction,
  * **Then** the sandbox ledger view shall reflect the updated balances, KYC flags, and active ticket counts within 5 seconds via polling.
  * **Given** a user clicking the "Global Factory Reset" button,
  * **When** the confirmation modal is accepted,
  * **Then** the system shall truncate all `transactions`, `teller_tickets`, and `audit_logs` tables, reset account balances to default seed values, and flush Upstash Redis session keys.

### REQ-003: Dynamic Transaction & Error Injection
* **EARS Syntax:** When a user submits the Custom Transaction Injector form on the sandbox UI, the system shall append a synthetic transaction record to the specified account with custom error codes and timestamps.
* **Acceptance Criteria:**
  * **Given** an existing mock account `1000000003`,
  * **When** the user injects a transaction with amount `₹75,000`, type `DEPOSIT`, status `FAILED`, and custom error `ERR_KYC_EXPIRED`,
  * **Then** the database shall commit the transaction immediately, making it available for proactive triage lookups by the Kiosk engine.

### REQ-004: Chaos Engineering & Latency Simulation
* **EARS Syntax:** Where a latency or failure rule is toggled on within the Sandbox Chaos Panel, the API gateway shall artificially inject delay timers or HTTP error codes into simulated Core Banking System (CBS) endpoints.
* **Acceptance Criteria:**
  * **Given** the Chaos Panel with "CBS Database Delay" set to `3000ms`,
  * **When** the kiosk authentication engine queries the mock ledger,
  * **Then** the API gateway shall delay the PostgreSQL response execution by exactly 3 seconds to test frontend loading states and timeout guardrails.