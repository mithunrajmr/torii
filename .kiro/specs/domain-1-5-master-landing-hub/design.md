# Architectural Design: Domain 1.5 — Master Landing Hub & Copilot

## 1. Architecture Overview & Data Flow
The Landing Hub acts as a reactive presentation layer that continuously binds to the mock Core Banking System (CBS) sandbox via long-polling. It decouples demonstration setup from manual API calls by wiring interactive showcase cards directly to the Domain 0 seeding engine.

```mermaid
sequenceDiagram
    autonumber
    participant U as User / Judge
    participant L as Landing Page (React)
    participant G as Section G Radar
    participant C as TORII Copilot
    participant S as Sandbox API (/api/sandbox/*)
    participant K as Kiosk Router (/api/kiosk/*)

    Note over L,G: Continuous Background Polling (Every 5s)
    G->>S: GET /api/sandbox/ledger
    S-->>G: { accounts: [...], activeFailures: [] }
    G->>G: Render Idle State (Green Radar)

    Note over U,L: 1-Click Showcase Demo
    U->>L: Click "Test Scenario" on Card A (Compliance)
    L->>S: POST /api/sandbox/seed/PAN_BLOCKED
    S-->>L: 200 OK (Account 1000000001 Seeded)
    L->>G: Trigger Immediate Radar Refetch
    G->>S: GET /api/sandbox/ledger
    S-->>G: { activeFailures: [{ account: "1000000001", error: "ERR_PAN_MISSING_OVER_50K" }] }
    G->>G: Transform to Active Alert State (Amber Pulse)
    
    U->>G: Click [⚡ Execute Agentic Fix Now]
    G->>U: Redirect to /kiosk (Pre-loaded Account: 1000000001)

    Note over U,C: Bottom-Right Copilot Interaction
    U->>C: Open Orb -> Type "How do I unblock my card?"
    C->>K: POST /api/kiosk/voice { text: "How do I unblock my card?" }
    K-->>C: { response: "...", actionChip: { label: "Launch Security Triage", route: "/kiosk" } }
    C->>C: Render Text + Extruded Action Chip Button