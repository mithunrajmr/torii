#!/usr/bin/env bash
# import-all.sh — Import all TORII agents and tools into watsonx Orchestrate.
# Run from the /watsonx-orchestrate directory.
#
# Prerequisites:
#   pip install "ibm-watsonx-orchestrate==2.10.0"
#   export WATSONX_ORCHESTRATE_API_KEY=<your-ibm-cloud-iam-key>
#   export WATSONX_ORCHESTRATE_ENDPOINT=<your-orchestrate-instance-url>

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

echo ""
echo "Step 1: Importing tools..."
echo "--------------------------"

orchestrate tools import -f tools/extract_pan_tool.py
echo "✓ extract_pan_from_image tool imported"

orchestrate tools import -f tools/aml_watchdog_tool.py
echo "✓ analyse_transaction_history tool imported"

orchestrate tools import -f tools/advisor_tool.py
echo "✓ generate_cross_sell_offer tool imported"

echo ""
echo "Step 2: Importing agents..."
echo "---------------------------"

orchestrate agents import -f agents/vision-ocr-agent/agent.yaml
echo "✓ torii-vision-ocr-agent imported"

orchestrate agents import -f agents/watchdog-aml-agent/agent.yaml
echo "✓ torii-watchdog-aml-agent imported"

orchestrate agents import -f agents/advisor-agent/agent.yaml
echo "✓ torii-advisor-agent imported"

echo ""
echo "Step 3: Listing registered agents..."
echo "-------------------------------------"
orchestrate agents list

echo ""
echo "================================================"
echo " Import complete!"
echo " Next: Copy the agent IDs above into your .env:"
echo ""
echo "   WXO_VISION_AGENT_ID=<id from list above>"
echo "   WXO_WATCHDOG_AGENT_ID=<id from list above>"
echo "   WXO_ADVISOR_AGENT_ID=<id from list above>"
echo "================================================"
