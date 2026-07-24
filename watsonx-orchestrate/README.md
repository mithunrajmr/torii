# TORII — watsonx Orchestrate Agent Definitions

This folder contains all agent YAML specifications and Python tool implementations
for the TORII AI swarm. These are imported into IBM watsonx Orchestrate using the
ADK CLI (`orchestrate`), and called from the Node.js backend via REST.

## Prerequisites

```bash
pip install "ibm-watsonx-orchestrate==2.10.0"
orchestrate --version
```

## Environment Setup

Create a `.env` file (or export these in your shell):

```env
# IBM Cloud IAM key — get from IBM Cloud > Manage > Access (IAM) > API keys
WATSONX_ORCHESTRATE_API_KEY=your_ibm_cloud_iam_api_key

# Your Orchestrate instance URL
WATSONX_ORCHESTRATE_ENDPOINT=https://api.us-south.watson-orchestrate.cloud.ibm.com

# Agent IDs — filled in after import (orchestrate agents list)
WXO_VISION_AGENT_ID=torii-vision-ocr-agent
WXO_WATCHDOG_AGENT_ID=torii-watchdog-aml-agent
WXO_ADVISOR_AGENT_ID=torii-advisor-agent
```

## Import All Agents

```bash
# From this directory
bash import-all.sh
```

## Agent Overview

| Agent | File | Purpose |
|---|---|---|
| Vision OCR | `agents/vision-ocr-agent/` | Extracts name + PAN number from uploaded document image |
| Watchdog AML | `agents/watchdog-aml-agent/` | Detects transaction structuring patterns (AML flag) |
| Advisor | `agents/advisor-agent/` | Generates personalised cross-sell offers |

## Architecture

```
Node.js Backend (mobileController.js)
    │
    └── swarmOrchestrator.js  (Promise.all — parallel)
            ├── visionAgent.js  → orchestrateClient.js → WXO Vision OCR Agent
            ├── watchdogAgent   → orchestrateClient.js → WXO Watchdog AML Agent
            └── advisorAgent    → orchestrateClient.js → WXO Advisor Agent
```
