#!/usr/bin/env bash
# import-all.sh — Import all TORII agents and tools into watsonx Orchestrate.
# Run from the /watsonx-orchestrate directory.
#
# Prerequisites:
#   pip install "ibm-watsonx-orchestrate==2.1.0"
#   export WATSONX_ORCHESTRATE_API_KEY=<your-ibm-cloud-iam-key>
#   export WATSONX_ORCHESTRATE_ENDPOINT=<your-orchestrate-instance-url>
#
# Import order matters — tools must exist before agents that reference them,
# and collaborator agents must exist before the Orchestrator that lists them.

set -e

echo "================================================"
echo " TORII watsonx Orchestrate — Import Pipeline"
echo "================================================"

# Activate Python venv if present
if [ -d "venv" ]; then
  source venv/bin/activate
elif [ -d ".venv" ]; then
  source .venv/bin/activate
fi

# Verify CLI is available
if ! command -v orchestrate &> /dev/null; then
  echo "[ERROR] orchestrate CLI not found. Run: pip install ibm-watsonx-orchestrate"
  exit 1
fi

# ─── Step 1: Import Tools ─────────────────────────────────────────────────────
echo ""
echo "Step 1: Importing tools..."
echo "--------------------------"

# Existing swarm tools
orchestrate tools import -k python -f tools/extract_pan_tool.py
echo "✓ extract_pan_from_image tool imported"

orchestrate tools import -k python -f tools/aml_watchdog_tool.py
echo "✓ analyse_transaction_history tool imported"

orchestrate tools import -k python -f tools/advisor_tool.py
echo "✓ generate_cross_sell_offer tool imported"

# New pipeline tools
orchestrate tools import -k python -f tools/bank_faq_tool.py
echo "✓ search_bank_faq + log_faq_query tools imported"

orchestrate tools import -k python -f tools/localizer_tool.py
echo "✓ process_kiosk_input tool imported"

orchestrate tools import -k python -f tools/translate_response_tool.py
echo "✓ translate_response_to_language tool imported"

orchestrate tools import -k python -f tools/orchestrator_tool.py
echo "✓ classify_customer_intent tool imported"

# ─── Step 2: Import Leaf Agents (no collaborators) ───────────────────────────
# These must be imported BEFORE the Orchestrator, which lists them as collaborators.
echo ""
echo "Step 2: Importing leaf agents (Vision, Watchdog, Advisor, FAQ, Localizer)..."
echo "----------------------------------------------------------------------------"

orchestrate agents import -f agents/vision-ocr-agent/agent.yaml
echo "✓ torii_vision_ocr_agent imported"

orchestrate agents import -f agents/watchdog-aml-agent/agent.yaml
echo "✓ torii_watchdog_aml_agent imported"

orchestrate agents import -f agents/advisor-agent/agent.yaml
echo "✓ torii_advisor_agent imported"

orchestrate agents import -f agents/faq-agent/agent.yaml
echo "✓ torii_faq_agent imported (40-entry KB, search_bank_faq + log_faq_query)"

orchestrate agents import -f agents/localizer-agent/agent.yaml
echo "✓ torii_localizer_agent imported"

# ─── Step 3: Import Orchestrator (depends on collaborator agents above) ───────
echo ""
echo "Step 3: Importing Master Orchestrator agent..."
echo "-----------------------------------------------"

orchestrate agents import -f agents/orchestrator-agent/agent.yaml
echo "✓ torii_master_orchestrator_agent imported"

# ─── Step 4: Verify all agents registered ────────────────────────────────────
echo ""
echo "Step 4: Listing all registered agents..."
echo "-----------------------------------------"
orchestrate agents list

echo ""
echo "================================================"
echo " Import complete!"
echo ""
echo " Copy the agent IDs printed above into your .env:"
echo ""
echo "   # Existing swarm agents"
echo "   WXO_VISION_AGENT_ID=<id>"
echo "   WXO_WATCHDOG_AGENT_ID=<id>"
echo "   WXO_ADVISOR_AGENT_ID=<id>"
echo ""
echo "   # New pipeline agents"
echo "   WXO_FAQ_AGENT_ID=<id>"
echo "   WXO_LOCALIZER_AGENT_ID=<id>"
echo "   WXO_ORCHESTRATOR_AGENT_ID=<id>"
echo "================================================"
