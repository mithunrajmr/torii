# Architectural Design: Domain 0 — Mock CBS Sandbox & Data Seeding Engine

## 1. Domain Architecture & Boundaries
The Sandbox Engine sits alongside the production API gateway as an administrative module. It directly manipulates PostgreSQL tables and Redis cache keys without passing through AI guardrails or PII redaction layers.

```mermaid
sequenceDiagram
    autonumber
    participant UI as Sandbox UI (/sandbox)
    participant API as Sandbox Gateway (/api/sandbox/*)
    participant DB as Supabase PostgreSQL
    participant Cache as Upstash Redis

    UI->>API: POST /api/sandbox/seed { persona: "PAN_BLOCKED" }
    API->>DB: DELETE FROM transactions WHERE account_id = '1000000001'
    API->>DB: UPSERT INTO accounts (account_number, pan_linked, balance) VALUES ('1000000001', false, 150000)
    API->>DB: INSERT INTO transactions (amount, status, error_code) VALUES (50000, 'FAILED', 'ERR_PAN_MISSING_OVER_50K')
    API->>Cache: DEL kiosk_session:1000000001
    API-->>UI: 200 OK (Persona Seeded Successfully)

    Note over UI,API: Chaos Latency Injection
    UI->>API: POST /api/sandbox/chaos { cbsDelayMs: 3000 }
    API->>Cache: SET chaos:cbs_delay 3000
    API-->>UI: 200 OK (Chaos Rules Active)