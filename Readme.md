# TORII — Enterprise Autonomous Branch Operations & Compliance Engine

<div align="center">

![TORII Logo](docs/Torii_logo.png)

### Next-Generation Agentic AI Kiosk, Mobile Handoff, & Human-in-the-Loop Operations for Retail Banking

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![IBM watsonx](https://img.shields.io/badge/IBM-watsonx%20Orchestrate-blueviolet.svg)](https://www.ibm.com/products/watsonx-orchestrate)
[![Google Gemini](https://img.shields.io/badge/Google-Gemini%202.5%20Flash-4285F4.svg)](https://deepmind.google/technologies/gemini/)
[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-339933.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-v18.3-61DAFB.svg)](https://reactjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-4169E1.svg)](https://supabase.com)
[![Redis](https://img.shields.io/badge/Redis-Upstash-DC382D.svg)](https://upstash.com)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v3.4-38B2AC.svg)](https://tailwindcss.com)

[Executive Summary](#executive-summary) • [System Architecture](#system-architecture) • [AI Swarm Architecture](#ai-swarm-architecture) • [Feature Matrix](#feature-matrix) • [API Documentation](#api-documentation) • [Installation Guide](#installation--setup)

</div>

---

## Table of Contents

- [Executive Summary](#executive-summary)
- [System Architecture](#system-architecture)
  - [High-Level Architecture](#high-level-architecture)
  - [User Journey Flow](#user-journey-flow)
  - [AI Swarm Orchestration](#ai-swarm-orchestration)
  - [Request Lifecycle](#request-lifecycle)
  - [Database ER Diagram](#database-er-diagram)
  - [Backend Architecture](#backend-architecture)
  - [Frontend Architecture](#frontend-architecture)
  - [Agent Communication Flow](#agent-communication-flow)
  - [QR Handoff Sequence](#qr-handoff-sequence)
  - [OCR & Anti-Fraud Inspection Pipeline](#ocr--anti-fraud-inspection-pipeline)
  - [Teller Approval Workflow](#teller-approval-workflow)
  - [Deployment Architecture](#deployment-architecture)
- [Feature Matrix (Implemented vs. Planned)](#feature-matrix)
- [Component Deep Dive](#component-deep-dive)
  - [Backend Modules](#backend-modules)
  - [Frontend Workspaces](#frontend-workspaces)
- [AI Architecture & Agent Swarm](#ai-architecture--agent-swarm)
  - [Master Orchestrator & Intent Router](#1-master-orchestrator--intent-router)
  - [Vision OCR & Anti-Fraud Agent](#2-vision-ocr--anti-fraud-agent)
  - [Watchdog AML Agent](#3-watchdog-aml-agent)
  - [Advisor Cross-Sell Agent](#4-advisor-cross-sell-agent)
  - [FAQ Q&A RAG Agent](#5-faq-qa-rag-agent)
  - [Localizer & Multilingual Agent](#6-localizer--multilingual-agent)
  - [Governance Sidecar & Audit Engine](#7-governance-sidecar--audit-engine)
  - [3-Tier Resilient Fallback Hierarchy](#3-tier-resilient-fallback-hierarchy)
- [Technology Stack Matrix](#technology-stack-matrix)
- [Directory Tree](#directory-tree)
- [Database Schema & Migrations](#database-schema--migrations)
- [API Documentation](#api-documentation)
- [Security & Regulatory Governance](#security--regulatory-governance)
- [Screenshots & Visual Gallery](#screenshots--visual-gallery)
- [Installation & Setup](#installation--setup)
- [Architecture Decision Records (ADRs)](#architecture-decision-records-adrs)
- [Performance & Reliability](#performance--reliability)
- [Future Roadmap](#future-roadmap)
- [License & Acknowledgments](#license--acknowledgments)

---

## Executive Summary

### The Problem
Retail bank branches across India face severe operational bottlenecks driven by regulatory compliance holds. Under Reserve Bank of India (RBI) guidelines and Section 139A of the Indian Income Tax Act, high-value transactions (such as cash deposits or fund transfers exceeding ₹50,000) **must be blocked** if the customer's Permanent Account Number (PAN) is not linked to their bank account.

When a customer encounters an `ERR_PAN_MISSING_OVER_50K` failure at an ATM or digital kiosk:
1. The transaction is instantly blocked by the Core Banking System (CBS).
2. The customer is forced to wait in long physical queues to submit paper KYC forms.
3. Bank branch staff (Tellers) suffer high administrative load manually re-keying document numbers and verifying physical identity cards.

### The TORII Solution
**TORII** is an enterprise-grade Autonomous Branch Operations & Compliance Engine. It intercepts compliance blocks in real-time and guides customers through a frictionless, self-service digital resolution path with **Human-in-the-Loop (HITL)** teller verification:

1. **Proactive Kiosk Diagnosis**: The customer logs into a self-service branch kiosk via 2FA OTP. TORII's Proactive Radar diagnoses recent transaction blocks and explains the issue using voice TTS and streaming text responses.
2. **Seamless QR Handoff**: The kiosk displays an encrypted, single-use QR token. Scanning it hands off the session to the customer's mobile smartphone without re-authentication.
3. **Multi-Agent AI Swarm Processing**: The mobile PWA captures the document photo. A parallel AI swarm executing on **IBM watsonx Orchestrate** and **Google Gemini 2.5 Flash** performs multimodal Vision OCR, anti-fraud tamper detection, AML structuring risk analysis, and personalized cross-sell offer generation in under 2 seconds.
4. **Human-in-the-Loop Teller Approval**: Extracted identity data and compliance flags populate the real-time Teller Workspace dashboard. A human teller approves or rejects the request with a single click, automatically updating the CBS account record and lifting the transaction block.

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│ Customer Kiosk  │ ────> │ Mobile Handoff  │ ────> │  AI Agent Swarm │ ────> │ Teller Approval │
│  2FA & Diagnosis│       │ Document Upload │       │ Vision/AML/Offer│       │ Real-Time HITL  │
└─────────────────┘       └─────────────────┘       └─────────────────┘       └─────────────────┘
```

---

## System Architecture

### High-Level Architecture

The following diagram illustrates the complete end-to-end topology of TORII across client applications, API gateway, cache layers, relational database, AI orchestrator swarm, and external service providers:

```mermaid
flowchart TD
    subgraph Clients ["Client Layer"]
        Kiosk["🖥️ Kiosk UI (React 18 / Vite)"]
        MobilePWA["📱 Mobile PWA (React / QR Handoff)"]
        TellerDash["👨‍💼 Teller Workspace Dashboard"]
        LandingHub["🌐 Landing Page & Copilot Widget"]
    end

    subgraph API Gateway ["Backend API Gateway (Express / Node.js)"]
        AuthMw["Auth & RBAC Middleware"]
        ChaosMw["Chaos Testing Interceptor"]
        KioskCtrl["kioskController.js"]
        MobileCtrl["mobileController.js"]
        TellerCtrl["tellerController.js"]
        ServiceCtrl["serviceController.js"]
        GovSidecar["governanceSidecar.js (PII Masking)"]
    end

    subgraph Cache & Sessions ["Cache & Session Layer"]
        Redis[("⚡ Upstash Redis\n• Sessions (30m)\n• OTP (300s)\n• QR Tokens (10m)\n• Retries & Config")]
    end

    subgraph Storage & Database ["Persistence Layer"]
        PostgreSQL[("🐘 PostgreSQL / Supabase\n• accounts\n• transactions\n• teller_tickets\n• service_requests\n• audit_logs\n• agent_performance_log")]
        S3Storage["🗄️ Supabase Storage\n• PAN Documents\n• Digital Signatures"]
    end

    subgraph AISwarm ["AI Swarm Orchestration Layer"]
        MasterOrch["🧠 Master Orchestrator (watsonx / Local Router)"]
        VisionAgent["👁️ Vision OCR Agent (Gemini 2.5 Flash / watsonx)"]
        WatchdogAgent["🐕 Watchdog AML Agent (watsonx / Gemini)"]
        AdvisorAgent["💡 Advisor Cross-Sell Agent (watsonx / Gemini)"]
        FaqAgent["❓ FAQ Q&A Agent (40-Entry KB RAG)"]
        LocalizerAgent["🌐 Localizer & Translation Agent"]
    end

    subgraph External ["External Services"]
        Brevo["📧 Brevo / Resend SMTP (OTP & Emails)"]
        WXO["🔵 IBM watsonx Orchestrate"]
        GeminiAPI["♊ Google Gen AI SDK (@google/genai)"]
    end

    Kiosk -->|HTTPS / SSE| AuthMw
    MobilePWA -->|Multipart Upload| AuthMw
    TellerDash -->|JWT Bearer| AuthMw
    LandingHub -->|REST| KioskCtrl

    AuthMw --> ChaosMw
    ChaosMw --> KioskCtrl & MobileCtrl & TellerCtrl & ServiceCtrl

    KioskCtrl & MobileCtrl & TellerCtrl <--> Redis
    MobileCtrl & ServiceCtrl --> S3Storage

    KioskCtrl & MobileCtrl & TellerCtrl <--> PostgreSQL
    GovSidecar -.->|Fire & Forget Audit| PostgreSQL

    MobileCtrl & KioskCtrl <--> AISwarm
    AISwarm --> WXO & GeminiAPI
    KioskCtrl --> Brevo
```

---

### User Journey Flow

```mermaid
journey
    title Customer & Teller Resolution Journey
    section 1. Kiosk Login & Diagnosis
      Customer enters account number: 5: Customer
      Receives & verifies 6-digit OTP: 5: Customer
      Proactive Radar diagnoses blocked tx: 5: System
    section 2. QR Mobile Handoff
      Kiosk generates encrypted QR token: 5: System
      Customer scans QR with smartphone: 5: Customer
      Mobile PWA opens session without re-login: 5: Mobile PWA
    section 3. Document Processing
      Customer snaps PAN card photo: 5: Customer
      Parallel AI Swarm extracts OCR & checks AML: 5: AI Swarm
      Anti-fraud clarity & tamper checks pass: 5: AI Swarm
    section 4. Teller Review & Resolution
      Ticket appears on Teller Dashboard: 5: System
      Teller reviews extracted OCR vs registered name: 5: Teller
      Teller clicks APPROVE: 5: Teller
      CBS record updated & PAN linked in seconds: 5: System
```

---

### AI Swarm Architecture

All AI agent leg executions (Vision OCR, Watchdog AML, Advisor Cross-Sell) are orchestrated concurrently via `Promise.all()` to achieve sub-2-second total latency:

```mermaid
flowchart TD
    UploadReq["📱 Mobile Upload Request (File Buffer + Account ID)"] --> SwarmOrchestrator["⚡ swarmOrchestrator.js (Promise.all)"]

    subgraph Swarm Leg 1 ["Leg 1: Multimodal Vision OCR"]
        SwarmOrchestrator --> Leg1["visionAgent.js"]
        Leg1 --> GeminiFlash["♊ Gemini 2.5 Flash Multimodal"]
        GeminiFlash --> Heuristics["fixPanHeuristics()\n• 0/O, 1/I, 5/S, 8/B corrections\n• Position 4 Entity Type Check"]
        Heuristics --> PrivacyMask["maskAadhaarPrivacy()\n• Aadhaar XXXX-XXXX-1234"]
        PrivacyMask --> AntiFraud["evaluateEdgeCasesAndSpecimens()\n• Specimen / Sample detection\n• Hand / finger obstruction\n• Scribbles & Moiré screen capture"]
    end

    subgraph Swarm Leg 2 ["Leg 2: Watchdog AML Risk"]
        SwarmOrchestrator --> Leg2["runWatchdogAgent()"]
        Leg2 --> FetchTx["Query 48h Transaction History"]
        FetchTx --> WXOWatchdog["watsonx Watchdog Agent"]
        WXOWatchdog -.->|Fallback| GeminiAML["Gemini Flash AML Analyzer"]
    end

    subgraph Swarm Leg 3 ["Leg 3: Personalized Advisor"]
        SwarmOrchestrator --> Leg3["runAdvisorAgent()"]
        Leg3 --> FetchAcc["Fetch Account Balance & Name"]
        FetchAcc --> WXOAdvisor["watsonx Advisor Agent"]
        WXOAdvisor -.->|Fallback| GeminiAdvisor["Gemini Flash Campaign Generator"]
        GeminiAdvisor -.->|Fallback| RuleAdvisor["Hyper-Personalized Rule Engine\n• Premier / High Yield / Instant Credit"]
    end

    AntiFraud --> Combine["Combine Results & Evaluate Entity Match"]
    Leg2 --> Combine
    Leg3 --> Combine

    Combine --> Telemetry["Fire-and-Forget Telemetry\n• agent_performance_log\n• PII Redacted via governanceSidecar"]
    Combine --> ReturnPayload["Return { ocr, watchdog, advisor, entityVerification }"]
```

---

### Request Lifecycle

```mermaid
sequenceDiagram
    autonumber
    actor Customer
    participant Kiosk as 🖥️ Kiosk UI
    participant Gateway as 🚪 Express API Gateway
    participant Redis as ⚡ Upstash Redis
    participant DB as 🐘 PostgreSQL (Supabase)
    participant Swarm as 🧠 AI Swarm
    participant Teller as 👨‍💼 Teller Workspace

    Customer->>Kiosk: Enter 10-digit Account Number
    Kiosk->>Gateway: POST /api/auth/otp/request
    Gateway->>DB: SELECT id, email FROM accounts
    Gateway->>Redis: SETEX otp:{account_id} 300 {otp}
    Gateway-->>Kiosk: 200 OK { masked_email }

    Customer->>Kiosk: Enter 6-digit OTP
    Kiosk->>Gateway: POST /api/auth/otp/verify
    Gateway->>Redis: GET otp:{account_id}
    Gateway->>DB: SELECT recent ERR_PAN_MISSING_OVER_50K tx
    Gateway->>Redis: SETEX kiosk:session:{jti} 1800 {account_id}
    Gateway-->>Kiosk: 200 OK { jwt, failed_tx_summary, login_swarm }

    Kiosk->>Gateway: POST /api/auth/qr/generate (JWT)
    Gateway->>Redis: SETEX qr:token:{token} 600 {account_id}
    Gateway-->>Kiosk: 200 OK { qr_token, deep_link_url }

    Customer->>Kiosk: Scan QR Code with Phone
    Kiosk->>Customer: Render QR Code & Handoff Prompt
```

---

### Database ER Diagram

The PostgreSQL database schema consists of 9 normalized tables supporting core banking entities, compliance logs, AI performance metrics, and multi-service workflows:

```mermaid
erDiagram
    accounts ||--o{ transactions : "has ledger entries"
    accounts ||--o{ teller_tickets : "has pending/historical tickets"
    accounts ||--o{ service_requests : "initiates multi-document requests"
    accounts ||--o{ faq_query_log : "submits FAQ questions"
    accounts ||--o{ audit_logs : "actor in governance log"

    service_requests ||--o{ service_documents : "contains uploaded documents"
    teller_tickets ||--o{ agent_performance_log : "linked performance metrics"

    accounts {
        uuid id PK
        uuid user_id
        varchar account_number UK
        varchar full_name
        varchar email
        decimal balance
        boolean pan_linked
        varchar pan_number
        varchar aadhaar_number
        boolean aadhaar_linked
        varchar address_line1
        varchar address_line2
        varchar city
        varchar state
        varchar pincode
        varchar kyc_status
        jsonb nominee_details
        timestamp created_at
    }

    transactions {
        uuid id PK
        uuid account_id FK
        decimal amount
        varchar error_code
        timestamp created_at
    }

    teller_tickets {
        uuid id PK
        uuid account_id FK
        ticket_status status
        varchar document_path
        jsonb ocr_data
        float ai_confidence
        float name_mismatch_score
        boolean aml_flagged
        varchar session_id
        uuid reviewed_by
        varchar rejection_reason
        timestamp created_at
    }

    audit_logs {
        uuid id PK
        varchar event_type
        jsonb payload_snapshot
        uuid actor_id FK
        varchar session_id
        timestamp created_at
    }

    agent_performance_log {
        uuid id PK
        varchar agent_name
        uuid ticket_id FK
        varchar session_id
        jsonb input_summary
        jsonb output_summary
        varchar teller_outcome
        boolean teller_override
        timestamp created_at
    }

    agent_config {
        varchar agent_name PK
        float clarity_threshold
        float confidence_floor
        float name_match_hard_reject
        float name_match_soft_flag
        integer aml_tx_count_threshold
        bigint aml_amount_threshold
        text prompt_suffix
        timestamp updated_at
        varchar updated_by
    }

    faq_query_log {
        uuid id PK
        uuid account_id FK
        varchar session_id
        text query_text
        varchar detected_domain
        boolean was_answered
        float confidence
        varchar matched_faq_id
        timestamp created_at
    }

    faq_kb_proposals {
        uuid id PK
        text proposed_question
        text proposed_answer
        varchar proposed_category
        text_array proposed_keywords
        uuid_array source_query_ids
        varchar status
        varchar reviewed_by
        text review_notes
        timestamp created_at
        timestamp reviewed_at
    }

    service_requests {
        uuid id PK
        uuid account_id FK
        service_type_enum service_type
        service_status_enum status
        jsonb form_data
        varchar digital_signature_path
        jsonb ai_verification_summary
        varchar session_id
        varchar reviewed_by
        varchar rejection_reason
        timestamp created_at
        timestamp updated_at
    }

    service_documents {
        uuid id PK
        uuid service_request_id FK
        varchar document_type
        varchar document_path
        jsonb ocr_data
        float clarity_score
        timestamp created_at
    }
```

---

### Backend Architecture

```mermaid
flowchart LR
    subgraph Routes ["Router Layer (src/routes/)"]
        R_Auth["authRoutes.js"]
        R_Kiosk["kioskRoutes.js"]
        R_Mobile["mobileRoutes.js"]
        R_Teller["tellerRoutes.js"]
        R_Service["serviceRoutes.js"]
        R_System["systemRoutes.js"]
        R_Sandbox["sandboxRoutes.js"]
        R_Debug["debugRoutes.js"]
    end

    subgraph Middleware ["Middleware Layer (src/middleware/)"]
        M_RBAC["rbac.js (JWT & Session Check)"]
        M_Chaos["chaosInterceptor.js (Fault Injection)"]
    end

    subgraph Controllers ["Controller Layer (src/controllers/)"]
        C_Auth["authController.js"]
        C_Kiosk["kioskController.js"]
        C_Mobile["mobileController.js"]
        C_Teller["tellerController.js"]
        C_Service["serviceController.js"]
        C_Sandbox["sandboxController.js"]
    end

    subgraph Services ["Services & Cache (src/services/ & src/cache/)"]
        S_Session["sessionManager.js"]
        S_Redis["redisClient.js"]
        S_Storage["storageService.js"]
        S_Config["configService.js"]
        S_Notify["notificationService.js"]
    end

    subgraph AI ["AI Swarm Core (src/ai/)"]
        AI_Orch["swarmOrchestrator.js"]
        AI_Vision["visionAgent.js"]
        AI_Intent["intentRouter.js"]
        AI_FAQ["faqAgent.js"]
        AI_Entity["entityMatcherAgent.js"]
        AI_Gov["governanceSidecar.js"]
    end

    Routes --> Middleware
    Middleware --> Controllers
    Controllers <--> Services
    Controllers <--> AI
```

---

### Frontend Architecture

```mermaid
flowchart TD
    subgraph Entry ["App Entry Point"]
        Main["main.jsx"] --> App["App.jsx"]
        App --> AppRoutes["routes/index.jsx (Lazy Loading)"]
    end

    subgraph Workspaces ["Frontend Workspaces (src/pages/)"]
        subgraph Landing ["1. Master Landing Hub"]
            LandingMaster["LandingMaster.jsx"]
            CopilotWidget["LandingCopilotWidget.jsx"]
            WorkspaceCards["WorkspaceCards.jsx"]
        end

        subgraph KioskPage ["2. Kiosk Workspace"]
            KioskLogin["KioskLogin.jsx (2FA OTP)"]
            KioskTriage["KioskTriage.jsx (Voice/Text Triage)"]
        end

        subgraph MobilePage ["3. Mobile PWA Workspace"]
            DocUpload["DocumentUpload.jsx (Camera capture)"]
            MultiVault["MultiDocVault.jsx (Multi-doc uploads)"]
            DynForm["DynamicServiceForm.jsx"]
            StatusPoller["StatusPoller.jsx (Live status)"]
        end

        subgraph TellerPage ["4. Teller Workspace"]
            TellerLogin["TellerLogin.jsx"]
            TellerDash["Dashboard.jsx (HITL Approval Queue)"]
            QueueList["QueueList.jsx"]
            ApprovalCtrl["ApprovalControls.jsx"]
            TellerAcc["TellerAccounts.jsx"]
        end

        subgraph ToolsPage ["5. Demo & Sandbox Tools"]
            SandboxDash["SandboxDashboard.jsx (Control Plane)"]
            OcrLab["OcrDemoPage.jsx (Gemini Vision Lab)"]
            DebugConsole["AgentDebugConsole.jsx (Telemetry)"]
        end
    end

    AppRoutes --> Landing & KioskPage & MobilePage & TellerPage & ToolsPage
```

---

### Agent Communication Flow

```mermaid
flowchart TD
    UserQuery["Kiosk User Query / Voice Input"] --> Localizer["Localizer Agent (localizeInput)"]
    Localizer --> RedactedInput["PII-Redacted English Input"]

    RedactedInput --> IntentRouter["Master Orchestrator (routeIntent)"]

    IntentRouter -->|Intent: PAN_MISSING| ShowQR["Display QR Code Handoff"]
    IntentRouter -->|Intent: SERVICE_HANDOFF| ServiceQR["Display Service QR Code"]
    IntentRouter -->|Intent: ACCOUNT_STATUS| CBSLookup["Query CBS Account Ledger"]
    IntentRouter -->|Intent: GENERAL_TRIAGE| TellerEscalation["Direct to Teller Counter"]

    IntentRouter -->|Intent: FAQ_QUERY| FAQAgent["FAQ Q&A RAG Agent"]

    subgraph FAQ Execution ["FAQ Parallel Race Execution"]
        FAQAgent --> LocalKB["1. Local 40-Entry KB (< 1ms)"]
        FAQAgent --> WXOFAQ["2. watsonx FAQ Agent"]
        FAQAgent --> GeminiFAQ["3. Gemini Flash FAQ Fallback"]
    end

    LocalKB --> FAQWinner{"Select Best Answer"}
    WXOFAQ --> FAQWinner
    GeminiFAQ --> FAQWinner

    FAQWinner --> LogQuery["logFaqQuery() → faq_query_log"]
    FAQWinner --> SpeakResponse["TTS Voice Response + UI Display"]
```

---

### QR Handoff Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Customer
    participant Kiosk as 🖥️ Kiosk Screen
    participant Gateway as 🚪 API Gateway
    participant Redis as ⚡ Upstash Redis
    participant Mobile as 📱 Customer Mobile PWA

    Customer->>Kiosk: Selects "Link PAN Card"
    Kiosk->>Gateway: POST /api/auth/qr/generate (CUSTOMER JWT)
    Gateway->>Gateway: Generate 32-byte cryptographically secure random token
    Gateway->>Redis: SETEX qr:token:{token} 600 {account_id}
    Gateway-->>Kiosk: Return { qr_token, deep_link_url }
    Kiosk->>Customer: Render QR Code on display

    Customer->>Mobile: Scans QR code with camera
    Mobile->>Gateway: GET /mobile/{token}
    Gateway->>Gateway: deriveSessionId(token) = SHA256(token)[0:32]
    Gateway->>Redis: GET qr:token:{token} (Reads account_id, leaves token active for retries)
    Gateway-->>Mobile: Render DocumentUpload UI bound to session_id

    Mobile->>Gateway: POST /api/mobile/upload (qr_token, file)
    Gateway->>Redis: consumeQRToken(token) (Deletes token after successful ticket generation)
    Gateway-->>Mobile: Return { ticket_id, status: 'PENDING', cross_sell_offer }

    loop Poll Status Every 3 Seconds
        Mobile->>Gateway: GET /api/mobile/status/{token}
        Gateway->>DB: SELECT status FROM teller_tickets WHERE session_id = {session_id}
        Gateway-->>Mobile: Return { status: 'PENDING' | 'APPROVED' | 'REJECTED' }
    end
```

---

### OCR & Anti-Fraud Inspection Pipeline

```mermaid
flowchart TD
    ImageBuffer["Uploaded Document Buffer"] --> GeminiVision["processVisionOCR() via Gemini 2.5 Flash"]
    GeminiVision --> RawExtraction["Raw Multimodal JSON Extraction"]

    RawExtraction --> Heuristics["fixPanHeuristics()\n• Alphanumeric OCR confusion fixes (0/O, 1/I, 5/S, 8/B, 2/Z)\n• Position 4 Entity Status code validation (P, C, H, F, A, T, B, L, J, G)"]

    Heuristics --> PrivacyMask["maskAadhaarPrivacy()\n• Mask first 8 digits of Aadhaar -> XXXX-XXXX-1234"]

    PrivacyMask --> Guardrails["evaluateEdgeCasesAndSpecimens()\nHuman Compliance Officer Inspection"]

    subgraph Inspection Rules ["Anti-Fraud & Quality Guardrails"]
        Guardrails --> CheckSpecimen{"1. Specimen / Dummy / Sample?"}
        CheckSpecimen -->|Yes| RejectSpecimen["Set clarity_score = 0.0, rejection_reason = SPECIMEN_OR_DUMMY_DOCUMENT_DETECTED"]

        Guardrails --> CheckObstruction{"2. Finger / Hand Obstruction?"}
        CheckObstruction -->|Yes| RejectObstruction["Cap clarity_score < 0.40, rejection_reason = HAND_OR_FINGER_OBSTRUCTION_DETECTED"]

        Guardrails --> CheckDefacement{"3. Scribbles / Screen Moiré?"}
        CheckDefacement -->|Yes| RejectDefacement["Cap clarity_score < 0.45, rejection_reason = SCRIBBLES_AND_DEFACEMENT_DETECTED"]
    end

    Guardrails --> NameMatch["computeNameMatchScore()\n• Levenshtein distance against CBS full_name"]

    NameMatch --> QualityGate{"Clarity Score >= 0.80?"}
    QualityGate -->|No & Retries Left| RetakeImage["Return 400 RETAKE_IMAGE (Attempt + 1)"]
    QualityGate -->|No & Retries Exhausted| ForceManual["Set status = PENDING_MANUAL_REVIEW"]
    QualityGate -->|Yes| CheckNameMatch{"Name Match Score"}

    CheckNameMatch -->|< 0.50| HardReject["Return 400 MISMATCH_ERROR"]
    CheckNameMatch -->|0.50 – 0.79| SoftFlag["Set status = PENDING_MANUAL_REVIEW"]
    CheckNameMatch -->|>= 0.80| DirectPass["Set status = PENDING"]
```

---

### Teller Approval Workflow

```mermaid
flowchart TD
    TicketQueue["Teller Dashboard Ticket Queue"] --> TellerSelect["Teller selects ticket for review"]
    TellerSelect --> DisplayData["Display extracted OCR, confidence, name mismatch score & AML flags"]

    TellerSelect --> ActionDecision{"Teller Action"}

    ActionDecision -->|APPROVE| AMLCheck{"AML Flagged?"}
    AMLCheck -->|Yes| BlockApprove["Return 403 ERR_AML_APPROVAL_BLOCKED\n(Must escalate AML flagged tickets)"]
    AMLCheck -->|No| ExecuteApproval["1. UPDATE accounts SET pan_linked = true, pan_number = {pan}\n2. UPDATE service fulfillment columns\n3. UPDATE teller_tickets & service_requests SET status = 'APPROVED'"]

    ActionDecision -->|REJECT| ExecuteReject["UPDATE teller_tickets SET status = 'REJECTED', rejection_reason = {reason}"]
    ActionDecision -->|ESCALATE| ExecuteEscalate["UPDATE teller_tickets SET status = 'ESCALATED'"]

    ExecuteApproval --> PostAction["Post-Action Fire-and-Forget Hooks"]
    ExecuteReject --> PostAction
    ExecuteEscalate --> PostAction

    subgraph Post Hooks ["Fire-and-Forget Hooks"]
        PostAction --> EmailNotify["sendTicketStatusEmail() to customer"]
        PostAction --> AuditLog["emitAuthEvent() to audit_logs"]
        PostAction --> FeedbackLoop["writeAgentFeedback() to agent_performance_log\n• Calculate teller_override boolean"]
    end
```

---

### Deployment Architecture

```mermaid
flowchart TD
    subgraph ClientBrowsers ["User Web Browsers"]
        KioskBrowser["Kiosk Terminal (Chrome / Kiosk Mode)"]
        MobileBrowser["Smartphone Mobile Safari / Chrome"]
        TellerBrowser["Teller Desktop Workstation"]
    end

    subgraph CloudHosting ["Production Cloud Hosting"]
        subgraph Vercel ["Frontend Platform (Vercel / Netlify)"]
            ViteBundle["Built React SPA Bundle"]
        end

        subgraph Render ["Backend Server (Render / Railway / GCP Cloud Run)"]
            NodeExpress["Node.js 18 ESM Express Server"]
        end
    end

    subgraph ManagedDB ["Managed Cloud Database Services"]
        SupabaseDB[("🐘 Supabase PostgreSQL\n• Port 5432 / SSL\n• Connection Pooling")]
        SupabaseStorage["🗄️ Supabase Storage S3 Bucket"]
        UpstashRedis[("⚡ Upstash Redis REST\n• TLS Encrypted")]
    end

    subgraph AICloud ["Enterprise AI Services"]
        IBMWatsonx["🔵 IBM watsonx Orchestrate Cloud"]
        GoogleGemini["♊ Google Gemini AI Platform"]
    end

    ClientBrowsers -->|HTTPS| ViteBundle
    ClientBrowsers -->|REST API / SSE| NodeExpress

    NodeExpress -->|Postgres Protocol| SupabaseDB
    NodeExpress -->|HTTPS REST| SupabaseStorage
    NodeExpress -->|HTTPS REST| UpstashRedis

    NodeExpress -->|IAM Auth HTTPS| IBMWatsonx
    NodeExpress -->|API Key HTTPS| GoogleGemini
```

---

## Feature Matrix

Every capability in TORII is categorized by its verification state in the current codebase:

### ✅ Implemented Features

| Domain | Feature | Description | Implementation Source |
| :--- | :--- | :--- | :--- |
| **Authentication** | **2FA OTP Login** | 6-digit OTP dispatch via SMTP/Resend with Redis 300s TTL & 3-attempt lockouts | [authController.js](file:///c:/Users/2mrmi/Downloads/IBM%20hackon/backend/src/controllers/authController.js#L105-L215) |
| **Authentication** | **Kiosk & Teller JWT** | Role-based signed JWT access tokens (`CUSTOMER` 35m TTL, `TELLER` 8h TTL) | [authController.js](file:///c:/Users/2mrmi/Downloads/IBM%20hackon/backend/src/controllers/authController.js#L236-L256) |
| **Kiosk Engine** | **Proactive Radar** | Intercepts `ERR_PAN_MISSING_OVER_50K` failed transactions from CBS ledger on login | [authController.js](file:///c:/Users/2mrmi/Downloads/IBM%20hackon/backend/src/controllers/authController.js#L72-L94) |
| **Kiosk Engine** | **Voice & Text Triage** | Speech-to-Text (STT) and Text-to-Speech (TTS) kiosk voice interaction loop | [KioskTriage.jsx](file:///c:/Users/2mrmi/Downloads/IBM%20hackon/frontend/src/pages/kiosk/KioskTriage.jsx) |
| **Kiosk Engine** | **SSE Token Streaming** | Real-time Server-Sent Events endpoint streaming answer tokens word-by-word | [kioskController.js](file:///c:/Users/2mrmi/Downloads/IBM%20hackon/backend/src/controllers/kioskController.js#L222-L309) |
| **Handoff** | **Encrypted QR Tokens** | Single-use 32-byte cryptographically secure QR handoff tokens (10m TTL) | [sessionManager.js](file:///c:/Users/2mrmi/Downloads/IBM%20hackon/backend/src/cache/sessionManager.js#L71-L91) |
| **Mobile PWA** | **Camera Capture & Upload** | Mobile document upload interface with camera capture and instant validation | [DocumentUpload.jsx](file:///c:/Users/2mrmi/Downloads/IBM%20hackon/frontend/src/pages/mobile/DocumentUpload.jsx) |
| **Mobile PWA** | **Live Status Polling** | Real-time status polling for mobile users waiting for teller approval | [StatusPoller.jsx](file:///c:/Users/2mrmi/Downloads/IBM%20hackon/frontend/src/pages/mobile/StatusPoller.jsx) |
| **AI Swarm** | **Parallel Execution** | `Promise.all()` parallel execution for Vision OCR, Watchdog AML, and Advisor | [swarmOrchestrator.js](file:///c:/Users/2mrmi/Downloads/IBM%20hackon/backend/src/ai/swarmOrchestrator.js#L374-L460) |
| **AI Swarm** | **Multimodal Vision OCR** | Gemini 2.5 Flash document extraction with PAN heuristic corrections & Aadhaar masking | [visionAgent.js](file:///c:/Users/2mrmi/Downloads/IBM%20hackon/backend/src/ai/visionAgent.js#L181-L326) |
| **AI Swarm** | **Anti-Fraud Inspection** | Human compliance officer guardrails for specimen detection, obstructions, and scribbles | [visionAgent.js](file:///c:/Users/2mrmi/Downloads/IBM%20hackon/backend/src/ai/visionAgent.js#L97-L171) |
| **AI Swarm** | **Watchdog AML Agent** | 48-hour transaction history analysis for structuring risk | [swarmOrchestrator.js](file:///c:/Users/2mrmi/Downloads/IBM%20hackon/backend/src/ai/swarmOrchestrator.js#L96-L151) |
| **AI Swarm** | **Advisor Cross-Sell** | Personalized 3-offer campaign generator incorporating account balance and name | [swarmOrchestrator.js](file:///c:/Users/2mrmi/Downloads/IBM%20hackon/backend/src/ai/swarmOrchestrator.js#L156-L291) |
| **AI Swarm** | **FAQ Q&A RAG Agent** | 40-entry bank policy knowledge base RAG with gap analysis logging | [faqAgent.js](file:///c:/Users/2mrmi/Downloads/IBM%20hackon/backend/src/ai/faqAgent.js#L76-L130) |
| **AI Swarm** | **Multilingual Localizer** | Language detection, input PII redaction, and response translation | [intentRouter.js](file:///c:/Users/2mrmi/Downloads/IBM%20hackon/backend/src/ai/intentRouter.js#L30-L79) |
| **Governance** | **PII Privacy Redaction** | Deep-cloning recursive string maskers for PAN and account numbers | [governanceSidecar.js](file:///c:/Users/2mrmi/Downloads/IBM%20hackon/backend/src/ai/governanceSidecar.js#L45-L70) |
| **Governance** | **Immutable Audit Log** | Fire-and-forget audit event logger with 3x exponential backoff retry | [governanceSidecar.js](file:///c:/Users/2mrmi/Downloads/IBM%20hackon/backend/src/ai/governanceSidecar.js#L106-L160) |
| **Governance** | **Agent Feedback Loop** | Records teller outcomes and calculates `teller_override` flags to retrain models | [tellerController.js](file:///c:/Users/2mrmi/Downloads/IBM%20hackon/backend/src/controllers/tellerController.js#L39-L67) |
| **Teller Workspace**| **HITL Approval Queue** | Real-time queue listing tickets with OCR data, clarity scores, and AML flags | [Dashboard.jsx](file:///c:/Users/2mrmi/Downloads/IBM%20hackon/frontend/src/pages/teller/Dashboard.jsx) |
| **Teller Workspace**| **Secure Media Viewer** | Signed URL generation for high-security document inspection | [SecureImageDisplay.jsx](file:///c:/Users/2mrmi/Downloads/IBM%20hackon/frontend/src/pages/teller/SecureImageDisplay.jsx) |
| **Teller Workspace**| **AML Hard Block** | Enforces mandatory escalation for AML-flagged tickets (prevents accidental approval) | [tellerController.js](file:///c:/Users/2mrmi/Downloads/IBM%20hackon/backend/src/controllers/tellerController.js#L171-L177) |
| **Multi-Service** | **7 Branch Services** | Full KYC, Aadhaar Link, PAN Link, Address Change, Nominee Update, Account Upgrade, High-Value Clearance | [006_expanded_branch_services.sql](file:///c:/Users/2mrmi/Downloads/IBM%20hackon/backend/src/db/migrations/006_expanded_branch_services.sql) |
| **Sandbox & Dev** | **Mock CBS Control Plane** | Persona seeder (6 customer personas), factory reset, transaction injector, ledger inspector, chaos fault simulator | [SandboxDashboard.jsx](file:///c:/Users/2mrmi/Downloads/IBM%20hackon/frontend/src/pages/sandbox/SandboxDashboard.jsx) |

### 🚧 Planned Enhancements (Blueprint)

| Feature | Category | Target Release | Architectural Vision |
| :--- | :--- | :--- | :--- |
| **Biometric Face Match** | Security / Auth | Phase 4 | Live camera liveness check & face match against Aadhaar vault photo |
| **WhatsApp Bot Handoff** | Omnichannel | Phase 4 | Alternative mobile handoff flow via WhatsApp Business API messaging |
| **Automated KB Expansion** | AI Governance | Phase 5 | Auto-compiling `faq_kb_proposals` into active watsonx tools based on gap clusters |
| **Universal Counter Display** | Branch Hardware | Phase 5 | Physical branch LED counter token calling integration |

---

## Component Deep Dive

### Backend Modules

```
backend/
├── scripts/
│   └── verify-infra.js        # Color-coded diagnostic CLI script testing DB, Redis, Gemini, watsonx
├── src/
│   ├── index.js               # Primary Express server setup, startup credential checks, health probes, dev routes
│   ├── ai/
│   │   ├── swarmOrchestrator.js  # Parallel Promise.all() swarm orchestrator for Vision, AML, and Advisor
│   │   ├── visionAgent.js        # Multimodal Gemini vision OCR, PAN heuristics, Aadhaar masking & anti-fraud
│   │   ├── intentRouter.js       # Master Orchestrator intent routing & local fallback classifier
│   │   ├── faqAgent.js           # 40-entry bank policy RAG agent with parallel AI race lookup
│   │   ├── entityMatcherAgent.js # Name match scoring & cross-document verification
│   │   ├── governanceSidecar.js  # PII redaction, immutable audit logging with 3x retry backoff
│   │   └── orchestrateClient.js  # IBM watsonx Orchestrate REST API client wrapper
│   ├── cache/
│   │   ├── redisClient.js        # Upstash Redis REST client initialization & helper functions
│   │   └── sessionManager.js     # OTP storage, lockout tracking, kiosk session & QR token manager
│   ├── controllers/
│   │   ├── authController.js     # 2FA OTP request/verify, kiosk JWT, QR token generation, staff login
│   │   ├── kioskController.js    # Kiosk query routing, SSE token streaming, public copilot handler
│   │   ├── mobileController.js   # Mobile document upload, parallel swarm execution, status polling
│   │   ├── tellerController.js   # HITL ticket queue, approve/reject/escalate handlers, feedback loop
│   │   ├── serviceController.js  # Multi-service request initiation, schema fetching & submission
│   │   ├── sandboxController.js  # Dev sandbox control plane, persona seeding, reset, chaos rules
│   │   ├── accountController.js  # Customer account details & transaction history queries
│   │   └── systemController.js   # Proactive Radar failed transaction aggregation endpoint
│   ├── db/
│   │   ├── index.js              # PostgreSQL client connection pooling (`postgres` package)
│   │   ├── migrate.js            # SQL migration runner reading SQL files sequentially
│   │   └── migrations/           # SQL migration files (001 through 006)
│   ├── middleware/
│   │   ├── rbac.js               # JWT verification & role-based access control (CUSTOMER vs TELLER)
│   │   └── chaosInterceptor.js   # Fault injection middleware (latency delay & HTTP error injection)
│   ├── routes/                   # Express route definitions for all API domains
│   └── services/
│       ├── configService.js      # Dynamic agent threshold configuration service (cached 5 min)
│       ├── notificationService.js# Multi-channel notification service (SMTP -> Resend -> Gateway)
│       └── storageService.js     # Supabase Storage document upload & signed URL generator
```

### Frontend Workspaces

```
frontend/src/
├── main.jsx                     # Vite React entry point
├── App.jsx                      # App root container
├── index.css                    # Tailwind CSS imports & custom styles
├── routes/
│   └── index.jsx                # React Router v6 setup with Suspense lazy loading per workspace
├── pages/
│   ├── landing/
│   │   ├── LandingMaster.jsx          # Public landing hub showcasing platform capabilities
│   │   ├── LandingCopilotWidget.jsx   # Interactive AI Copilot drawer for public visitors
│   │   └── WorkspaceCards.jsx         # Navigation cards to Kiosk, Teller, Mobile & Sandbox
│   ├── kiosk/
│   │   ├── KioskLogin.jsx             # Self-service kiosk 2FA OTP login interface
│   │   └── KioskTriage.jsx            # Voice/text query triage with TTS, QR display & SSE streaming
│   ├── mobile/
│   │   ├── DocumentUpload.jsx         # Mobile PWA PAN card camera capture & upload screen
│   │   ├── MultiDocVault.jsx          # Multi-document vault for complex branch services
│   │   ├── DynamicServiceForm.jsx     # Form generator based on service schemas
│   │   └── StatusPoller.jsx           # Real-time status tracker for customer mobile screens
│   ├── teller/
│   │   ├── TellerLogin.jsx            # Staff login screen issuing long-lived TELLER JWTs
│   │   ├── Dashboard.jsx              # Main HITL Teller Workspace with live queue & review modal
│   │   ├── QueueList.jsx              # Filterable pending ticket list
│   │   ├── ApprovalControls.jsx       # Action buttons for Approve, Reject, and Escalate
│   │   ├── SecureImageDisplay.jsx     # High-security signed URL image viewer with zoom
│   │   └── TellerAccounts.jsx         # Branch accounts management & KYC status list
│   ├── ocr/
│   │   └── OcrDemoPage.jsx            # Interactive Gemini 2.5 Flash Vision OCR testing lab
│   ├── debug/
│   │   └── AgentDebugConsole.jsx      # Real-time telemetry inspector for agent executions
│   └── sandbox/
│       └── SandboxDashboard.jsx       # Developer control plane (persona seeder, chaos, ledger)
```

---

## AI Architecture & Agent Swarm

TORII's multi-agent swarm is designed around **specialized task allocation**. Rather than relying on a single monolithic prompt, individual agents focus on specific domain challenges:

```
                          ┌───────────────────────────┐
                          │   Master Orchestrator     │
                          │   Intent Classification   │
                          └─────────────┬─────────────┘
                                        │
         ┌──────────────────────────────┼──────────────────────────────┐
         ▼                              ▼                              ▼
┌─────────────────┐            ┌─────────────────┐            ┌─────────────────┐
│  Vision OCR     │            │  Watchdog AML   │            │  Advisor Agent  │
│  Gemini 2.5     │            │  watsonx / ML   │            │  Cross-Sell AI  │
└─────────────────┘            └─────────────────┘            └─────────────────┘
```

### 1. Master Orchestrator & Intent Router
- **Module**: [intentRouter.js](file:///c:/Users/2mrmi/Downloads/IBM%20hackon/backend/src/ai/intentRouter.js)
- **Primary Agent ID**: `WXO_ORCHESTRATOR_AGENT_ID` (IBM watsonx Orchestrate)
- **Function**: Classifies customer kiosk queries into actionable intents (`PAN_MISSING`, `FAQ_QUERY`, `ACCOUNT_STATUS`, `GENERAL_TRIAGE`, `ADDRESS_CHANGE`, etc.).
- **Local Fallback**: Includes `localFallbackRoute()`, a deterministic keyword-based classifier that guarantees 100% kiosk uptime even during cloud service outages.

### 2. Vision OCR & Anti-Fraud Agent
- **Module**: [visionAgent.js](file:///c:/Users/2mrmi/Downloads/IBM%20hackon/backend/src/ai/visionAgent.js)
- **Primary Model**: Google Gemini 2.5 Flash via `@google/genai` SDK
- **Key Features**:
  - **PAN Heuristic Corrections**: `fixPanHeuristics()` repairs OCR confusions (e.g., mistaking `0` for `O`, `1` for `I`, `5` for `S`, `8` for `B`, `2` for `Z`) and validates position 4 entity type codes.
  - **Privacy Masking**: `maskAadhaarPrivacy()` automatically redacts the first 8 digits of Aadhaar numbers to ensure UIDAI compliance.
  - **Anti-Fraud Guardrails**: `evaluateEdgeCasesAndSpecimens()` inspects documents from a human bank compliance officer's perspective, detecting sample templates, finger obstructions, scribbles, and digital screen Moiré patterns.
  - **Name Match Scoring**: `computeNameMatchScore()` calculates Levenshtein similarity between extracted document names and registered CBS account holders.

### 3. Watchdog AML Agent
- **Module**: [swarmOrchestrator.js](file:///c:/Users/2mrmi/Downloads/IBM%20hackon/backend/src/ai/swarmOrchestrator.js#L96-L151)
- **Primary Agent ID**: `WXO_WATCHDOG_AGENT_ID` (IBM watsonx Orchestrate)
- **Function**: Evaluates 48-hour account transaction histories for illegal structuring patterns (smurfing) designed to evade ₹50,000 reporting thresholds.

### 4. Advisor Cross-Sell Agent
- **Module**: [swarmOrchestrator.js](file:///c:/Users/2mrmi/Downloads/IBM%20hackon/backend/src/ai/swarmOrchestrator.js#L156-L291)
- **Primary Agent ID**: `WXO_ADVISOR_AGENT_ID` (IBM watsonx Orchestrate)
- **Function**: Generates 3 hyper-personalized banking campaign offers (Premier Fixed Deposits, Metal Credit Cards, Wealth Management, SIP Plans) tailored to the customer's balance tier and name.

### 5. FAQ Q&A RAG Agent
- **Module**: [faqAgent.js](file:///c:/Users/2mrmi/Downloads/IBM%20hackon/backend/src/ai/faqAgent.js)
- **Primary Agent ID**: `WXO_FAQ_AGENT_ID` (IBM watsonx Orchestrate)
- **Function**: Answers general banking queries against a 40-entry bank policy knowledge base. Races local KB lookup against Gemini Flash AI and watsonx to deliver sub-second responses. Logs unanswered questions to `faq_query_log` for automatic gap analysis.

### 6. Localizer & Multilingual Agent
- **Module**: [intentRouter.js](file:///c:/Users/2mrmi/Downloads/IBM%20hackon/backend/src/ai/intentRouter.js#L30-L79)
- **Primary Agent ID**: `WXO_LOCALIZER_AGENT_ID` (IBM watsonx Orchestrate)
- **Function**: Handles automatic language detection (supporting Hindi, Tamil, Telugu, Kannada, Marathi, Gujarati, Bengali, etc.), PII sanitization of raw inputs, and response translation.

### 7. Governance Sidecar & Audit Engine
- **Module**: [governanceSidecar.js](file:///c:/Users/2mrmi/Downloads/IBM%20hackon/backend/src/ai/governanceSidecar.js)
- **Function**: Deep-clones and masks all PAN numbers (`XXXXX-1234-X`) and 10-digit account numbers (`****NNNN`) before writing audit records to PostgreSQL. Retries up to 3 times with exponential backoff (100ms, 200ms, 400ms) without ever blocking the primary API HTTP response.

### 3-Tier Resilient Fallback Hierarchy

To ensure 99.99% availability required by core banking environments, TORII implements a strict 3-tier fallback hierarchy across all AI services:

```
   Tier 1: Primary AI Engine ──> IBM watsonx Orchestrate (Cloud Agents)
                │ (on timeout / API error)
                ▼
   Tier 2: Multimodal Fallback ─> Google Gemini 2.5 Flash AI
                │ (on quota / network failure)
                ▼
   Tier 3: Local Engine ─────────> Deterministic Rule & Heuristic Engine
```

---

## Technology Stack Matrix

| Layer | Technology | Version | Purpose | Reason for Selection | Alternatives Considered |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Frontend Core** | React | v18.3.1 | Workspace Component UI | Concurrent rendering, hook ecosystem, component isolation | Vue.js, Angular, Svelte |
| **Build System** | Vite | v5.4.1 | Lightning HMR & Bundler | Native ESM, fast cold startup, seamless React HMR | Webpack, Parcel, Rollup |
| **Styling** | Tailwind CSS | v3.4.10 | Utility-first CSS | Rapid styling, neomorphic design tokens, zero CSS bloat | Bootstrap, Styled Components |
| **Icons** | Lucide React | v0.427 | Visual iconography | Clean SVG icons with low bundle footprint | FontAwesome, Material Icons |
| **Backend Core** | Node.js / Express | v18+ / v4.19 | API Gateway & Routing | High concurrency event loop, rich npm ecosystem, lightweight | Python FastAPI, Java Spring Boot |
| **Relational DB** | PostgreSQL (Supabase) | v15+ | Persistent Ledger & Schema | ACID compliance, JSONB support, row-level security | MySQL, MongoDB |
| **Cache & Session** | Upstash Redis | v1.34 | Ephemeral Sessions & OTP | REST-based serverless client, global low latency | Redis Enterprise, Memcached |
| **Primary AI Swarm**| IBM watsonx Orchestrate | v2.1 | Multi-Agent Orchestration | Native tool execution, enterprise agent collaboration | AutoGen, CrewAI, LangChain |
| **Multimodal Vision**| Google Gemini AI SDK | v2.13 (`@google/genai`) | Document Extraction & Anti-Fraud | State-of-the-art multimodal vision capability | Tesseract OCR, AWS Textract |
| **Storage** | Supabase Storage | S3 | Document Image Storage | Secure private S3 buckets with signed URL generation | AWS S3, Azure Blob |
| **Testing** | Vitest & Supertest | v2.0 / v7.0 | Unit, Integration & E2E Testing | Vite integration, fast parallel execution | Jest, Mocha |

---

## Directory Tree

```
c:/Users/2mrmi/Downloads/IBM hackon/
├── README.md                           # Comprehensive production documentation
├── DEVLOG.md                           # Session execution logs & development journal
├── LICENSE                             # MIT License file
├── package.json                        # Root package manifest & npm scripts
├── postcss.config.js                   # PostCSS configuration for Tailwind
├── tailwind.config.js                  # Custom Tailwind theme tokens & neomorphic shadows
├── vite.config.js                      # Vite build & proxy configuration
├── ocr_rules.txt                       # Detailed PAN/Aadhaar OCR inspection rules
│
├── docs/                               # System documentation & design artifacts
│   ├── Torii_logo.png                  # Primary high-res TORII logo asset
│   ├── Dbscheme-postgres.txt           # Raw PostgreSQL schema reference
│   ├── design.md                       # High-level architecture design document
│   ├── requirements.md                 # System functional requirements
│   └── tasks.md                        # Task tracker & implementation checklist
│
├── public/                             # Public static assets
│   └── torii-logo.jpg                  # Standard JPEG logo asset
│
├── backend/                            # Node.js Express API Gateway codebase
│   ├── scripts/
│   │   └── verify-infra.js             # CLI diagnostic script for infrastructure health
│   └── src/
│       ├── index.js                    # Express app initialization & health check endpoints
│       ├── ai/                         # Agent Swarm implementation
│       │   ├── entityMatcherAgent.js   # Name matching & cross-document verification
│       │   ├── faqAgent.js             # Q&A RAG agent with 40-entry bank policy KB
│       │   ├── governanceSidecar.js    # PII masking & immutable audit log writer
│       │   ├── intentRouter.js         # Master Orchestrator intent classifier & local fallbacks
│       │   ├── orchestrateClient.js    # IBM watsonx Orchestrate REST client
│       │   ├── swarmOrchestrator.js    # Parallel Promise.all() swarm execution engine
│       │   └── visionAgent.js          # Gemini 2.5 Flash OCR, PAN heuristics & anti-fraud
│       ├── cache/
│       │   ├── redisClient.js          # Upstash Redis client wrapper
│       │   └── sessionManager.js       # OTP, session TTL & QR token manager
│       ├── config/
│       │   └── serviceSchemas.js       # JSON schemas for 7 retail branch services
│       ├── controllers/
│       │   ├── accountController.js    # Account details & transaction queries
│       │   ├── authController.js       # OTP 2FA, JWT issuance, QR tokens & staff login
│       │   ├── kioskController.js      # Kiosk query routing & SSE streaming
│       │   ├── mobileController.js     # Mobile upload, parallel swarm & status polling
│       │   ├── sandboxController.js    # Dev control plane, persona seeder & chaos rules
│       │   ├── serviceController.js    # Multi-service initiation & form submission
│       │   ├── systemController.js     # Proactive Radar failed transaction aggregator
│       │   └── tellerController.js     # HITL ticket queue, actions & feedback loop
│       ├── db/
│       │   ├── index.js                # PostgreSQL client pool connection
│       │   ├── migrate.js              # SQL migration execution script
│       │   └── migrations/             # Sequential SQL schema migrations (001 to 006)
│       ├── middleware/
│       │   ├── chaosInterceptor.js     # Fault injection latency & error middleware
│       │   └── rbac.js                 # JWT auth & role validation middleware
│       ├── routes/                     # Express router declarations for all APIs
│       ├── sandbox/
│       │   ├── personaDefinitions.js   # 6 pre-configured customer testing personas
│       │   ├── seedEngine.js           # Database seeding logic
│       │   └── resetEngine.js          # Factory reset execution engine
│       └── services/
│           ├── configService.js        # Dynamic agent threshold configuration service
│           ├── notificationService.js  # Email notification gateway (SMTP / Resend)
│           └── storageService.js       # Supabase Storage S3 file upload & signed URL helper
│
├── frontend/                           # React 18 SPA codebase
│   └── src/
│       ├── main.jsx                    # React main entry point
│       ├── App.jsx                     # Top-level App component
│       ├── index.css                   # Global styles & Tailwind directives
│       ├── components/                 # Reusable UI components
│       ├── pages/                      # Page views categorized by workspace
│       │   ├── debug/                  # Agent Debug Console
│       │   ├── kiosk/                  # Kiosk Login & Triage screens
│       │   ├── landing/                # Landing Hub & Public Copilot
│       │   ├── mobile/                 # Mobile PWA upload & status screens
│       │   ├── ocr/                    # Gemini Multimodal OCR testing lab
│       │   ├── sandbox/                # Developer Control Plane
│       │   └── teller/                 # Teller Workspace Dashboard & Accounts
│       └── routes/
│           └── index.jsx               # React Router configuration with lazy loading
│
├── watsonx-orchestrate/                # IBM watsonx Orchestrate definitions
│   ├── import-all.ps1                  # PowerShell import script for all tools & agents
│   ├── import-all.sh                   # Bash import script for all tools & agents
│   ├── agents/                         # Agent YAML configuration definitions
│   └── tools/                          # Python tool scripts for watsonx integration
│
└── tests/                              # Vitest test suite
    ├── api/                            # API integration tests
    ├── cache/                          # Redis cache unit tests
    ├── component/                      # React UI component tests
    └── e2e/                            # End-to-end user journey tests
```

---

## Database Schema & Migrations

The system utilizes 6 sequential PostgreSQL migration scripts (`backend/src/db/migrations/`):

### Table Breakdown

#### 1. `accounts`
Stores Core Banking System customer records.
```sql
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    account_number VARCHAR(10) UNIQUE NOT NULL,
    full_name VARCHAR(100),
    email VARCHAR(255),
    balance DECIMAL(12, 2) DEFAULT 0.00,
    pan_linked BOOLEAN DEFAULT FALSE,
    pan_number VARCHAR(10),
    aadhaar_number VARCHAR(12),
    aadhaar_linked BOOLEAN DEFAULT FALSE,
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(100),
    pincode VARCHAR(10),
    kyc_status VARCHAR(20) DEFAULT 'PENDING',
    nominee_details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

#### 2. `transactions`
CBS transaction ledger capturing compliance failure codes.
```sql
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES accounts(id),
    amount DECIMAL(12, 2) NOT NULL,
    error_code VARCHAR(50), -- e.g. 'ERR_PAN_MISSING_OVER_50K'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

#### 3. `teller_tickets`
Human-in-the-Loop review queue.
```sql
CREATE TABLE teller_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES accounts(id),
    status ticket_status DEFAULT 'PENDING', -- PENDING, PENDING_MANUAL_REVIEW, APPROVED, REJECTED, ESCALATED
    document_path VARCHAR(255) NOT NULL,
    ocr_data JSONB,
    ai_confidence FLOAT,
    name_mismatch_score FLOAT,
    aml_flagged BOOLEAN DEFAULT FALSE,
    session_id VARCHAR(64),
    reviewed_by UUID,
    rejection_reason VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

#### 4. `audit_logs`
Immutable regulatory governance audit trail.
```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(50) NOT NULL,
    payload_snapshot JSONB NOT NULL, -- PII redacted (PANs -> XXXXX-1234-X, Accounts -> ****NNNN)
    actor_id UUID,
    session_id VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

#### 5. `agent_performance_log`
Tracks AI swarm executions and teller feedback loops.
```sql
CREATE TABLE agent_performance_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_name VARCHAR(50) NOT NULL, -- 'VISION_OCR' | 'WATCHDOG_AML' | 'ADVISOR'
    ticket_id UUID REFERENCES teller_tickets(id) ON DELETE SET NULL,
    session_id VARCHAR(64),
    input_summary JSONB,
    output_summary JSONB,
    teller_outcome VARCHAR(20),     -- APPROVED | REJECTED | ESCALATED
    teller_override BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

#### 6. `agent_config`
Live-editable AI thresholds cached for 5 minutes.
```sql
CREATE TABLE agent_config (
    agent_name VARCHAR(50) PRIMARY KEY,
    clarity_threshold FLOAT DEFAULT 0.80,
    confidence_floor FLOAT DEFAULT 0.60,
    name_match_hard_reject FLOAT DEFAULT 0.50,
    name_match_soft_flag FLOAT DEFAULT 0.80,
    aml_tx_count_threshold INTEGER DEFAULT 3,
    aml_amount_threshold BIGINT DEFAULT 200000,
    prompt_suffix TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by VARCHAR(50) DEFAULT 'INITIAL_SEED'
);
```

#### 7. `faq_query_log` & `faq_kb_proposals`
Tracks kiosk FAQ questions for KB gap analysis and staff review.

#### 8. `service_requests` & `service_documents`
Normalized multi-service request storage supporting 7 distinct branch service flows.

---

## API Documentation

### System & Health Endpoints

#### `GET /api/health`
- **Purpose**: System health check probing PostgreSQL database and Redis connectivity.
- **Auth**: None
- **Response (200 OK)**:
```json
{
  "status": "OK",
  "system": "TORII Compliance Engine",
  "timestamp": "2026-07-27T20:00:00.000Z",
  "checks": {
    "db": { "status": "ok", "source": "supabase" },
    "redis": { "status": "ok", "source": "upstash" }
  },
  "env": { "NODE_ENV": "development", "DB": "supabase", "REDIS": "upstash" }
}
```

#### `GET /api/system/radar`
- **Purpose**: Proactive Radar aggregating deduplicated failed transactions (`ERR_PAN_MISSING_OVER_50K`) from the last 24 hours.
- **Auth**: None (Masked Output)
- **Response (200 OK)**:
```json
{
  "activeCount": 1,
  "failures": [
    {
      "account_id": "8f2d5e1a-...",
      "account_number_masked": "****0001",
      "first_name": "Arjun",
      "amount": 75000,
      "failed_at": "2026-07-27T19:30:00.000Z"
    }
  ],
  "snapshot_at": "2026-07-27T20:00:00.000Z"
}
```

---

### Authentication Endpoints

#### `POST /api/auth/otp/request`
- **Purpose**: Requests a 6-digit OTP for a given 10-digit account number.
- **Request Body**: `{ "account_number": "1000000001" }`
- **Response (200 OK)**: `{ "masked_email": "a***n@example.com" }`
- **Error Responses**: `400 ERR_INVALID_ACCOUNT_NUMBER`, `404 ERR_ACCOUNT_NOT_FOUND`, `503 ERR_SERVICE_UNAVAILABLE`

#### `POST /api/auth/otp/verify`
- **Purpose**: Verifies 6-digit OTP, issues kiosk JWT, and returns proactive failed transaction summary.
- **Request Body**: `{ "account_number": "1000000001", "otp": "123456" }`
- **Response (200 OK)**:
```json
{
  "jwt": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "failed_tx_summary": {
    "count": 1,
    "most_recent_amount": 75000,
    "most_recent_created_at": "2026-07-27T19:30:00.000Z"
  },
  "account_status": {
    "account_number": "1000000001",
    "pan_linked": false,
    "full_name": "Arjun Sharma"
  },
  "login_swarm": { ... }
}
```

#### `POST /api/auth/qr/generate`
- **Purpose**: Generates a single-use QR token for mobile handoff.
- **Auth**: `Authorization: Bearer <CUSTOMER JWT>`
- **Request Body**: `{ "service_type": "PAN_LINK" }`
- **Response (200 OK)**:
```json
{
  "qr_token": "a1b2c3d4e5f6...",
  "deep_link_url": "http://localhost:5173/mobile/a1b2c3d4e5f6.../service_type=PAN_LINK",
  "service_type": "PAN_LINK"
}
```

#### `POST /api/auth/staff-login`
- **Purpose**: Authenticates bank staff and issues long-lived TELLER JWT (8h TTL).
- **Request Body**: `{ "employee_id": "TELLER001", "password": "torii2024" }`
- **Response (200 OK)**: `{ "teller_jwt": "...", "name": "Demo Teller", "role": "TELLER" }`

---

### Kiosk Triage & Streaming Endpoints

#### `POST /api/kiosk/query`
- **Purpose**: Processes text or transcribed speech queries from kiosk users.
- **Auth**: `Authorization: Bearer <CUSTOMER JWT>`
- **Request Body**: `{ "query": "Why was my transaction blocked?", "language": "en" }`
- **Response (200 OK)**:
```json
{
  "intent": "PAN_MISSING",
  "downstream": "mobile_handoff",
  "voiceResponse": "It looks like we need your PAN card to proceed. Please scan the QR code with your phone.",
  "showQR": true,
  "confidence": 0.75,
  "detectedLanguage": "en"
}
```

#### `POST /api/kiosk/stream`
- **Purpose**: SSE token streaming endpoint. Emits metadata instantly (`< 10ms`) and streams answer text word-by-word.
- **Headers**: `Accept: text/event-stream`
- **Events Emitted**: `meta`, `token`, `done`

---

### Mobile Document Processing Endpoints

#### `POST /api/mobile/upload`
- **Purpose**: Accepts multipart document image upload from mobile PWA, triggers parallel AI swarm, and creates a teller ticket.
- **Auth**: Single-use QR token in request body
- **Form Data**: `qr_token`, `document` (file buffer)
- **Response (200 OK)**:
```json
{
  "ticket_id": "d3b07384-...",
  "status": "PENDING",
  "cross_sell_offer": {
    "offers": [
      {
        "id": "offer-1",
        "badge": "🔥 8.40% ROI FOR ARJUN",
        "title": "Torii Premier Fixed Deposit",
        "offer": "Arjun, grow your ₹75.0K balance with guaranteed 8.40% returns.",
        "cta": "Lock In 8.40% Rate",
        "type": "FD"
      }
    ]
  }
}
```
- **Error Responses**: `400 RETAKE_IMAGE`, `400 MISMATCH_ERROR`, `401 ERR_INVALID_OR_EXPIRED_QR_TOKEN`

#### `GET /api/mobile/status/:token`
- **Purpose**: Polls ticket review status for mobile PWA using QR token session ID.
- **Response (200 OK)**: `{ "status": "PENDING" | "APPROVED" | "REJECTED", "rejection_reason": null }`

---

### Teller Workspace Endpoints

#### `GET /api/teller/tickets`
- **Purpose**: Fetches pending ticket queue for teller review.
- **Auth**: `Authorization: Bearer <TELLER JWT>`
- **Query Params**: `status=pending` (default) or `status=all`
- **Response (200 OK)**: Array of ticket objects including `ocr_data`, `ai_confidence`, `name_mismatch_score`, `aml_flagged`.

#### `POST /api/teller/action`
- **Purpose**: Approves, rejects, or escalates a ticket in the teller queue.
- **Auth**: `Authorization: Bearer <TELLER JWT>`
- **Request Body**: `{ "ticket_id": "...", "action": "APPROVE" | "REJECT" | "ESCALATE", "reason": "Optional" }`
- **Response (200 OK)**: `{ "status": "APPROVED", "ticket_id": "..." }`
- **Error Response**: `403 ERR_AML_APPROVAL_BLOCKED` (if attempting to approve an AML-flagged ticket)

---

## Security & Regulatory Governance

TORII is designed from the ground up to comply with Indian banking privacy standards (DPDP Act 2023) and RBI security guidelines:

1. **PII Masking & Privacy**:
   - `governanceSidecar.js` automatically redacts all 10-character PAN strings to `XXXXX-1234-X` and 10-digit account numbers to `****NNNN` before writing to database logs.
   - `maskAadhaarPrivacy()` redacts the first 8 digits of Aadhaar numbers (`XXXX-XXXX-1234`).
2. **Short-Lived Ephemeral State**:
   - OTP codes expire after **300 seconds** (5 minutes).
   - Single-use QR handoff tokens expire after **600 seconds** (10 minutes) and are immediately deleted upon ticket creation.
   - Kiosk JWTs expire after **35 minutes**.
3. **Anti-Timing & Lockout Protections**:
   - Failed OTP attempts trigger a 15-minute lock after 3 consecutive failures. Lockout checks execute *before* hash comparisons to prevent timing attacks.
4. **Human-in-the-Loop AML Safeguards**:
   - Tickets flagged by the Watchdog AML agent **cannot be approved directly by tellers** (`403 ERR_AML_APPROVAL_BLOCKED`). They must be escalated to a compliance officer.

---

## Screenshots & Visual Gallery

### System Architecture Overview
![TORII Logo](public/torii-logo.jpg)

### Visual Gallery & Interface Showcase

<details>
<summary>📸 <b>Click to expand interface screenshot placeholders & visual descriptions</b></summary>

#### 1. Self-Service Kiosk Triage Terminal (`/kiosk/triage`)
- **Visual Display**: Dark-mode neomorphic kiosk UI with animated voice orb, Proactive Radar alert banner (diagnosing `ERR_PAN_MISSING_OVER_50K`), streaming response text, and large high-contrast QR code display.

#### 2. Mobile Document Handoff PWA (`/mobile/:token`)
- **Visual Display**: Mobile-optimized camera capture interface displaying document positioning frame, real-time image clarity meter, PAN extraction preview, and personalized cross-sell offer cards.

#### 3. HITL Teller Workspace Dashboard (`/teller/dashboard`)
- **Visual Display**: Dual-pane teller workstation featuring real-time incoming queue list, side-by-side document image vs. extracted OCR fields comparison, name mismatch percentage badges, AML risk flags, and 1-click Approve/Reject controls.

#### 4. Developer Sandbox Control Plane (`/sandbox`)
- **Visual Display**: Developer testing suite featuring persona seeder buttons (6 pre-configured bank customers), real-time CBS ledger inspector table, factory reset triggers, and chaos fault injection controls.

#### 5. Multimodal Gemini OCR Lab (`/ocr-demo`)
- **Visual Display**: Interactive vision testing studio allowing drag-and-drop document uploads, raw JSON vision outputs, PAN heuristic fix logs, Aadhaar privacy masking verification, and quality score breakdowns.

</details>

---

## Installation & Setup

### Prerequisites
- **Node.js**: `v18.0.0` or higher
- **npm**: `v9.0.0` or higher
- **PostgreSQL**: Supabase account or local PostgreSQL 15+ instance
- **Redis**: Upstash Redis account or local Redis 6+ instance
- **API Keys**: IBM watsonx Orchestrate credentials (optional fallback available) & Google Gemini API Key

---

### Step 1: Clone Repository & Install Dependencies

```bash
# Clone the repository
git clone https://github.com/mithunrajmr/torii.git
cd torii

# Install Node.js dependencies
npm install
```

---

### Step 2: Configure Environment Variables

Copy `.env.example` to `.env` in the project root:

```bash
cp .env.example .env
```

Edit `.env` and fill in your credentials:

```ini
# Server Configuration
PORT=5000
NODE_ENV=development
JWT_SECRET=your-32-character-random-jwt-secret
DOMAIN=localhost:5173

# PostgreSQL / Supabase
SUPABASE_DB_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
SUPABASE_URL=https://[PROJECT_REF].supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Upstash Redis
REDIS_URL=https://[YOUR_DB].upstash.io
REDIS_TOKEN=your-upstash-rest-token

# Google Gemini AI (Multimodal Vision OCR Engine)
GEMINI_API_KEY=your-google-gemini-api-key
GEMINI_MODEL=gemini-2.5-flash

# IBM watsonx Orchestrate (Optional — Fallback Active If Blank)
WATSONX_ORCHESTRATE_API_KEY=your-ibm-cloud-iam-key
WATSONX_ORCHESTRATE_ENDPOINT=https://api.us-south.watson-orchestrate.cloud.ibm.com
WXO_VISION_AGENT_ID=your-vision-agent-id
WXO_WATCHDOG_AGENT_ID=your-watchdog-agent-id
WXO_ADVISOR_AGENT_ID=your-advisor-agent-id
WXO_FAQ_AGENT_ID=your-faq-agent-id
WXO_LOCALIZER_AGENT_ID=your-localizer-agent-id
WXO_ORCHESTRATOR_AGENT_ID=your-orchestrator-agent-id

# Email Delivery (SMTP / Resend)
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
```

---

### Step 3: Run Database Migrations

Apply the PostgreSQL migrations (`001` through `006`):

```bash
npm run migrate
```

---

### Step 4: Verify Infrastructure Connectivity

Run the automated diagnostic CLI script to verify that all database, cache, storage, and AI endpoints are online:

```bash
node backend/scripts/verify-infra.js
```

---

### Step 5: Start Development Servers

Start both frontend (Vite) and backend (Express) concurrently:

```bash
npm run dev:all
```

The applications will be accessible at:
- **Landing Hub**: [http://localhost:5173](http://localhost:5173)
- **Kiosk Terminal**: [http://localhost:5173/kiosk](http://localhost:5173/kiosk)
- **Teller Workspace**: [http://localhost:5173/teller](http://localhost:5173/teller)
- **Developer Sandbox**: [http://localhost:5173/sandbox](http://localhost:5173/sandbox)
- **Backend API Gateway**: [http://localhost:5000](http://localhost:5000)

---

### Step 6: Testing & Dev Bypass Utilities

#### Run Automated Test Suite
```bash
npm test          # Run full Vitest suite (unit, integration & E2E)
npm run test:unit # Unit tests only
npm run test:e2e  # End-to-end user journey tests
```

#### Single-Call Kiosk Bypass (Dev Mode Only)
To bypass SMS/Email OTP entry during local testing:
```bash
curl "http://localhost:5000/api/dev/kiosk-bypass?account_number=1000000001"
```

---

## Architecture Decision Records (ADRs)

### ADR-001: QR-Based Mobile Handoff
- **Context**: Entering complex document numbers or uploading images directly on a public kiosk touchscreen causes severe privacy risks and UI friction.
- **Decision**: Implement single-use, 32-byte cryptographically secure QR tokens that hand off the session to the customer's personal smartphone.
- **Consequences**: Enhanced document upload privacy, elimination of public terminal file storage, and leverage of native mobile cameras for higher OCR resolution.

### ADR-002: Upstash Redis for Ephemeral State
- **Context**: Kiosk OTPs, session heartbeat keys, and single-use QR tokens require high-speed access and strict expiration TTLs.
- **Decision**: Use Upstash Redis REST client for all ephemeral state.
- **Consequences**: Zero database bloat, serverless compatibility, and sub-10ms session lookup latencies.

### ADR-003: Multi-Agent Parallel Execution Architecture
- **Context**: Running OCR, AML risk scoring, and cross-sell offer generation sequentially resulted in unacceptable response latencies (>6 seconds).
- **Decision**: Orchestrate all agent legs concurrently via Node.js `Promise.all()`.
- **Consequences**: Reduced total document processing pipeline execution time to **under 1.8 seconds**.

### ADR-004: Mandatory Human-in-the-Loop (HITL) Approval
- **Context**: Fully autonomous AI updates to banking records carry regulatory risk under RBI guidelines regarding unverified identity documents.
- **Decision**: Mandate human teller review for all document uploads, presenting tellers with pre-extracted OCR data and AI confidence scores.
- **Consequences**: Zero risk of unauthorized automated account mutations, full regulatory compliance, and 90% reduction in teller manual entry time.

---

## Performance & Reliability

1. **Sub-2-Second Swarm Latency**: Parallel AI execution (`Promise.all()`) ensures document analysis completes in under 1,800ms.
2. **Fast-Path Local Classifiers**: Intent classification and FAQ lookups check deterministic local tables in `< 1ms` before hitting remote AI endpoints.
3. **Fire-and-Forget Governance**: Telemetry logging (`agent_performance_log`) and audit record generation (`audit_logs`) execute asynchronously post-HTTP response, ensuring zero user-facing latency penalties.
4. **Chaos Resilient**: Integrated chaos middleware (`chaosInterceptor.js`) allows developers to test system behavior under injected network latencies (up to 10s) and HTTP errors (500, 503, 429).

---

## Future Roadmap

- [ ] **Phase 4: Biometric Liveness Verification**: Integrate facial recognition liveness detection on mobile upload to compare selfie captures with Aadhaar document photos.
- [ ] **Phase 4: WhatsApp Business Handoff**: Provide an optional WhatsApp message dispatch alternative to QR code scanning for low-literacy customers.
- [ ] **Phase 5: Self-Healing KB Pipeline**: Automate the promotion of staff-approved `faq_kb_proposals` directly into active watsonx Orchestrate tool tools without code redeployment.
- [ ] **Phase 5: Core Banking System Adapters**: Build pluggable connectors for Finacle, TCS BaNCS, and Oracle FLEXCUBE CBS platforms.

---

## License & Acknowledgments

### License
This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

### Acknowledgments
- **IBM HackOn 2026**: Developed for the IBM HackOn Agentic AI Track.
- **IBM watsonx Orchestrate**: For multi-agent orchestration infrastructure.
- **Google DeepMind**: For the Gemini 2.5 Flash multimodal vision model.
- **Supabase & Upstash**: For database connection pooling and serverless Redis infrastructure.

<div align="center">
  <sub>Built with ❤️ for Indian Retail Banking Innovation</sub>
</div>
