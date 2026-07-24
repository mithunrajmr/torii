flowchart TD
    %% ==========================================
    %% STYLING DEFINITIONS (IBM Hackathon Theme)
    %% ==========================================
    classDef user fill:#f9f9f9,stroke:#333,stroke-width:2px,color:#000;
    classDef kiosk fill:#e0f7fa,stroke:#006064,stroke-width:2px,color:#000;
    classDef mobile fill:#e8eaf6,stroke:#1a237e,stroke-width:2px,color:#000;
    classDef backend fill:#fff3e0,stroke:#e65100,stroke-width:2px,color:#000;
    classDef ibm_ai fill:#e3f2fd,stroke:#0d47a1,stroke-width:3px,color:#0d47a1,font-weight:bold;
    classDef bg_agent fill:#f3e5f5,stroke:#4a148c,stroke-width:2px,color:#4a148c,stroke-dasharray: 5 5;
    classDef db fill:#eceff1,stroke:#37474f,stroke-width:2px,color:#000;
    classDef teller fill:#fce4ec,stroke:#880e4f,stroke-width:2px,color:#000;

    %% ==========================================
    %% EXTERNAL ACTORS
    %% ==========================================
    Customer((🧑 Customer)):::user
    BankTeller((👨‍💼 Bank Teller)):::user
    ComplianceTeam((📁 Compliance Team)):::user

    %% ==========================================
    %% SUBGRAPH 1: KIOSK FRONTEND
    %% ==========================================
    subgraph KIOSK [1. Branch Kiosk UI]
        K_Login[Enter Account No & OTP]:::kiosk
        K_VoiceInput[🔊 Voice/Text Input]:::kiosk
        K_Proactive[🔊 AI: Proactive Diagnosis]:::kiosk
        K_QRDisplay[📱 Display QR Code]:::kiosk
        K_Reset[🔄 Auto-Reset Session 2m]:::kiosk
    end

    %% ==========================================
    %% SUBGRAPH 2: MOBILE PWA
    %% ==========================================
    subgraph MOBILE [2. Mobile Web App]
        M_Scan((📷 Scan QR)):::mobile
        M_Upload[Upload PAN/Document Image]:::mobile
        M_CrossSell[Display Cross-Sell Offer]:::mobile
        M_Retake[Error: Image Blurry - Retake]:::mobile
    end

    %% ==========================================
    %% SUBGRAPH 3: BACKEND ORCHESTRATOR (Node.js)
    %% ==========================================
    subgraph BACKEND [3. Node.js API Gateway]
        B_Auth[Auth & Token Generation]:::backend
        B_Dispatcher[Traffic Dispatcher]:::backend
        B_SwarmSync[Parallel Swarm Synthesizer]:::backend
        B_Finalize[Ticket Creation & DB Updates]:::backend
    end

    %% ==========================================
    %% SUBGRAPH 4: DATABASES
    %% ==========================================
    subgraph DATABASES [4. State & Persistence]
        DB_Redis[(Redis: 10m QR & 2m Kiosk State)]:::db
        DB_Postgres[(PostgreSQL: CBS, Users, Tickets)]:::db
        DB_Audit[(PostgreSQL: Compliance Audit Logs)]:::db
        DB_Vector[(Vector DB: Bank Policies)]:::db
    end

    %% ==========================================
    %% SUBGRAPH 5: LIVE AI AGENT SWARM (IBM Cloud)
    %% ==========================================
    subgraph AI_SWARM [5. Live AI Agent Swarm]
        A_Localizer{Localizer Agent: STT/Translate}:::ibm_ai
        A_Regulator_In[Regulator Agent: PII Redaction]:::ibm_ai
        A_Orchestrator{Master Orchestrator: Intent Router}:::ibm_ai
        
        A_RAG[Diagnostic RAG Agent: Policy Answer]:::ibm_ai
        
        %% Parallel Execution Swarm
        A_Vision[Vision OCR Agent: Extract & Fuzzy Match]:::ibm_ai
        A_Watchdog[Watchdog Agent: AML Structuring Check]:::ibm_ai
        A_Advisor[Advisor Agent: Account Cross-Sell]:::ibm_ai
        
        A_Regulator_Out[Regulator Agent: Log Audit Trail]:::ibm_ai
    end

    %% ==========================================
    %% SUBGRAPH 6: ASYNCHRONOUS BACKGROUND AGENTS
    %% ==========================================
    subgraph BACKGROUND [6. Continuous Learning & Updates]
        A_Optimizer[Optimizer Agent: HITL Continuous Tuning]:::bg_agent
        A_Knowledge[Knowledge Engineer Agent: Policy Sync]:::bg_agent
    end

    %% ==========================================
    %% SUBGRAPH 7: TELLER DASHBOARD (HITL)
    %% ==========================================
    subgraph TELLER [7. Human-in-the-Loop Dashboard]
        T_Queue[View PENDING Tickets + AML Flags]:::teller
        T_Review[Compare OCR JSON vs Raw Image]:::teller
        T_Decision{1-Click Approve / Reject}:::teller
    end

    %% ==========================================
    %% WORKFLOW MAPPING & CONNECTIONS
    %% ==========================================

    %% Entry & Auth
    Customer --> K_Login
    K_Login --> B_Auth
    B_Auth <--> DB_Redis
    B_Auth <--> DB_Postgres
    
    %% Kiosk Input -> Sanitization -> Routing
    K_VoiceInput --> A_Localizer
    A_Localizer -- Translates to English --> A_Regulator_In
    A_Regulator_In -- Masks PII --> B_Dispatcher
    B_Dispatcher --> A_Orchestrator
    
    %% Proactive Routing (Failed Tx Found)
    B_Auth -- Fetches Failed CBS Tx --> K_Proactive
    K_Proactive -- User accepts fix --> B_Dispatcher
    B_Dispatcher -- Generates Token --> DB_Redis
    B_Dispatcher --> K_QRDisplay
    K_QRDisplay -. Releases Kiosk .-> K_Reset
    
    %% Policy RAG Routing
    A_Orchestrator -- Intent: General Policy --> A_RAG
    A_RAG <--> DB_Vector
    A_RAG --> A_Localizer
    A_Localizer -- Translates to Native Audio --> K_VoiceInput
    
    %% Mobile Handoff & Swarm Execution
    Customer --> M_Scan
    M_Scan --> M_Upload
    M_Upload --> B_SwarmSync
    
    %% Parallel Swarm Trigger
    B_SwarmSync -->|Parallel Thread 1| A_Vision
    B_SwarmSync -->|Parallel Thread 2| A_Watchdog
    B_SwarmSync -->|Parallel Thread 3| A_Advisor
    
    A_Watchdog <--> DB_Postgres
    A_Advisor <--> DB_Postgres
    
    %% Swarm Synthesis & Logic Gates
    A_Vision -- "Confidence < 80%" --> M_Retake
    M_Retake --> M_Upload
    
    A_Vision -- Valid JSON --> B_SwarmSync
    A_Watchdog -- Clean / AML Flag --> B_SwarmSync
    A_Advisor -- FD/Loan Offer --> B_SwarmSync
    
    B_SwarmSync -- Push Offer UI --> M_CrossSell
    
    %% Audit & Finalize
    B_SwarmSync --> A_Regulator_Out
    A_Regulator_Out --> DB_Audit
    A_Regulator_Out --> B_Finalize
    B_Finalize --> DB_Postgres
    
    %% HITL Teller Review
    DB_Postgres -. Webhook/Polling .-> T_Queue
    BankTeller --> T_Queue
    T_Queue --> T_Review
    T_Review --> T_Decision
    
    T_Decision -- Approve --> DB_Postgres
    DB_Postgres -- Sends Email Success --> Customer
    
    %% Background Agent Loops (The "Day 2" Ops)
    T_Decision -. Teller Corrections (Delta) .-> A_Optimizer
    A_Optimizer -. Prompt Tuning Job .-> A_Vision
    
    ComplianceTeam -- Uploads New PDF --> A_Knowledge
    A_Knowledge -- Generates Embeddings --> DB_Vector