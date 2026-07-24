# Product: Autonomous Branch Operations & Compliance Engine

An enterprise-grade banking kiosk and mobile triage system for Indian retail banks. It intercepts routine customer compliance blocks (e.g., unlinked PAN cards causing failed transactions) and resolves them without teller intervention for most cases.

## Core Flow

1. Customer authenticates at a **branch kiosk** — system proactively detects recent failed transactions
2. Customer scans a **QR code** to hand off document submission to their mobile phone
3. An **AI agent swarm** runs in parallel: Vision OCR extracts PAN data, Watchdog checks for AML flags, Advisor generates cross-sell offers
4. A **bank teller** reviews and approves/rejects via a HITL dashboard with a 1-click action
5. A **Regulator/Governance sidecar** redacts PII and writes immutable audit logs throughout

## Key Users

- **Customers** — resolve compliance blocks at the kiosk + mobile
- **Bank Tellers** — review and action AI-prepared tickets
- **Compliance Team** — upload policy PDFs, review audit trails

## Critical Business Rules

- Transactions above ₹50,000 are blocked with `ERR_PAN_MISSING_OVER_50K` if PAN is not linked
- AML-flagged tickets must NOT be auto-approved — they require mandatory human escalation
- QR sessions expire in 45 seconds; kiosk sessions expire in 2 minutes
- After 3 failed OCR attempts, bypass OCR and create a `PENDING_MANUAL_REVIEW` ticket
