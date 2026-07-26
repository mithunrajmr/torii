# TORII — watsonx Orchestrate Agent Definitions

This folder contains all agent YAML specifications and Python tool implementations
for the TORII AI swarm. These are imported into IBM watsonx Orchestrate using the
ADK CLI (`orchestrate`), and called from the Node.js backend via REST.

## Prerequisites

```bash
pip install "ibm-watsonx-orchestrate==2.1.0"
orchestrate --version
```

## Environment Setup

Create a `.env` file (or export these in your shell):

```env
WATSONX_ORCHESTRATE_API_KEY=your_ibm_cloud_iam_api_key
WATSONX_ORCHESTRATE_ENDPOINT=https://api.jp-tok.watson-orchestrate.cloud.ibm.com/instances/<id>

# Filled in after import (orchestrate agents list)
WXO_VISION_AGENT_ID=torii-vision-ocr-agent
WXO_WATCHDOG_AGENT_ID=torii-watchdog-aml-agent
WXO_ADVISOR_AGENT_ID=torii-advisor-agent
WXO_FAQ_AGENT_ID=torii-faq-agent
WXO_LOCALIZER_AGENT_ID=torii-localizer-agent
WXO_ORCHESTRATOR_AGENT_ID=torii-master-orchestrator-agent
```

## Import All Agents & Tools

```bash
# From the /watsonx-orchestrate directory
bash import-all.sh
```

Tools must be imported before agents. Leaf agents (FAQ, Localizer) must be
imported before the Orchestrator that lists them as collaborators.
See `import-all.sh` for the exact ordering.

---

## Agent Overview

### Pipeline Agents (Kiosk → Intent Routing)

| Agent | File | Model | Purpose |
|---|---|---|---|
| **Master Orchestrator** | `agents/orchestrator-agent/` | `granite-3-8b-instruct` | Entry point. Classifies intent (`PAN_MISSING`, `FAQ_QUERY`, `ACCOUNT_STATUS`, `GENERAL_TRIAGE`) and routes to the correct downstream flow. |
| **Localizer** | `agents/localizer-agent/` | `granite-3-8b-instruct` | Detects language of kiosk input (10 Indian languages), redacts PII (PAN, Aadhaar, mobile), returns clean English text. Also translates responses back to the customer's language for TTS. |
| **FAQ / QnA Diagnostic RAG** | `agents/faq-agent/` | `granite-3-8b-instruct` | Answers general banking questions (KYC, limits, rates, timings, products) by searching a structured bank policy knowledge base. Routes to teller if no confident answer found. |

### Swarm Agents (Mobile Upload → HITL)

| Agent | File | Model | Purpose |
|---|---|---|---|
| **Vision OCR** | `agents/vision-ocr-agent/` | `granite-3-2-vision-11b` | Extracts name + PAN number from uploaded document image. Scores clarity and confidence. |
| **Watchdog AML** | `agents/watchdog-aml-agent/` | `granite-3-8b-instruct` | Detects transaction structuring patterns (splitting to avoid ₹50k threshold). Returns `isSuspicious` flag + risk level. |
| **Advisor** | `agents/advisor-agent/` | `granite-3-8b-instruct` | Generates personalised cross-sell offer (FD, loan, wealth) based on account balance tier. |

---

## Tool Overview

| Tool File | Function(s) | Used By |
|---|---|---|
| `tools/extract_pan_tool.py` | `extract_pan_from_image` | Vision OCR agent |
| `tools/aml_watchdog_tool.py` | `analyse_transaction_history` | Watchdog AML agent |
| `tools/advisor_tool.py` | `generate_cross_sell_offer` | Advisor agent |
| `tools/bank_faq_tool.py` | `search_bank_faq` | FAQ agent |
| `tools/localizer_tool.py` | `process_kiosk_input`, `translate_response_to_language` | Localizer agent |
| `tools/orchestrator_tool.py` | `classify_customer_intent` | Master Orchestrator agent |

---

## Full Architecture

```
Customer speaks / types at Kiosk
        │
        ▼
[Localizer Agent]
  • Detects language (10 Indian langs)
  • Redacts PII (PAN, Aadhaar, mobile)
  • Returns clean English text
        │
        ▼
[Master Orchestrator Agent]
  • Classifies intent using account context + text
        │
        ├── intent: PAN_MISSING ──────────────────────────────────────────────┐
        │   show_qr: true                                                      │
        │   Customer scans QR on mobile                                        │
        │                                                                      ▼
        │                                              [Mobile PWA Upload]
        │                                              mobileController.js
        │                                                      │
        │                                                      ▼ (Promise.all)
        │                                         ┌────────────┬─────────────┐
        │                                         ▼            ▼             ▼
        │                                    [Vision OCR] [Watchdog] [Advisor]
        │                                         └────────────┴─────────────┘
        │                                                      │
        │                                                      ▼
        │                                         [Teller HITL Dashboard]
        │
        ├── intent: FAQ_QUERY ──────────────────────┐
        │                                           ▼
        │                                    [FAQ / QnA Agent]
        │                                    search_bank_faq KB
        │                                    → Localizer translates
        │                                    → TTS plays response
        │
        ├── intent: ACCOUNT_STATUS ────────────────┐
        │                                          ▼
        │                                   Account inquiry
        │                                   (backend DB lookup)
        │
        └── intent: GENERAL_TRIAGE ───────────────┐
                                                   ▼
                                          Teller escalation
                                          "Please go to counter"

Node.js Backend (orchestrateClient.js)
    │
    └── intentRouter.js     → calls Master Orchestrator agent
    └── faqAgent.js         → calls FAQ agent
    └── swarmOrchestrator.js → calls Vision / Watchdog / Advisor (Promise.all)
    └── governanceSidecar.js → PII redaction + audit log for all events
```

---

## Backend Integration

The Node.js backend calls agents via `orchestrateClient.js`. New files added:

- `backend/src/ai/intentRouter.js` — calls `torii_master_orchestrator_agent`
- `backend/src/ai/faqAgent.js` — calls `torii_faq_agent`
- `backend/src/routes/kioskRoutes.js` — `POST /api/kiosk/query` endpoint
- `backend/src/controllers/kioskController.js` — orchestrates the Localizer → Orchestrator → FAQ pipeline
