Write-Host "================================================" -ForegroundColor Cyan
Write-Host " TORII watsonx Orchestrate Import Pipeline" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan

Write-Host "Step 1: Importing tools..." -ForegroundColor Yellow
uvx --from "ibm-watsonx-orchestrate==2.1.0" orchestrate.exe tools import -k python -f tools/extract_pan_tool.py
uvx --from "ibm-watsonx-orchestrate==2.1.0" orchestrate.exe tools import -k python -f tools/aml_watchdog_tool.py
uvx --from "ibm-watsonx-orchestrate==2.1.0" orchestrate.exe tools import -k python -f tools/advisor_tool.py
uvx --from "ibm-watsonx-orchestrate==2.1.0" orchestrate.exe tools import -k python -f tools/bank_faq_tool.py
uvx --from "ibm-watsonx-orchestrate==2.1.0" orchestrate.exe tools import -k python -f tools/localizer_tool.py
uvx --from "ibm-watsonx-orchestrate==2.1.0" orchestrate.exe tools import -k python -f tools/translate_response_tool.py
uvx --from "ibm-watsonx-orchestrate==2.1.0" orchestrate.exe tools import -k python -f tools/orchestrator_tool.py

Write-Host "Step 2: Importing leaf agents..." -ForegroundColor Yellow
uvx --from "ibm-watsonx-orchestrate==2.1.0" orchestrate.exe agents import -f agents/vision-ocr-agent/agent.yaml
uvx --from "ibm-watsonx-orchestrate==2.1.0" orchestrate.exe agents import -f agents/watchdog-aml-agent/agent.yaml
uvx --from "ibm-watsonx-orchestrate==2.1.0" orchestrate.exe agents import -f agents/advisor-agent/agent.yaml
uvx --from "ibm-watsonx-orchestrate==2.1.0" orchestrate.exe agents import -f agents/faq-agent/agent.yaml
uvx --from "ibm-watsonx-orchestrate==2.1.0" orchestrate.exe agents import -f agents/localizer-agent/agent.yaml

Write-Host "Step 3: Importing Master Orchestrator agent..." -ForegroundColor Yellow
uvx --from "ibm-watsonx-orchestrate==2.1.0" orchestrate.exe agents import -f agents/orchestrator-agent/agent.yaml

Write-Host "Step 4: Listing registered agents..." -ForegroundColor Yellow
uvx --from "ibm-watsonx-orchestrate==2.1.0" orchestrate.exe agents list

Write-Host "================================================" -ForegroundColor Green
Write-Host " Import complete!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
