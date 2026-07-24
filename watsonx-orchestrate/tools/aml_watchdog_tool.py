"""
aml_watchdog_tool.py
Tool used by the AML Watchdog agent to evaluate transaction histories.
Imported into watsonx Orchestrate via: orchestrate tools import -f aml_watchdog_tool.py
"""

from ibm_watsonx_orchestrate.agent_builder.tools import tool
from typing import List
import json


@tool
def analyse_transaction_history(transactions_json: str) -> str:
    """
    Pre-process and summarise a transaction history for AML pattern analysis.

    Args:
        transactions_json: JSON string array of transactions.
            Each transaction: {"amount": number, "created_at": "ISO8601 string"}

    Returns:
        JSON string with computed AML risk signals:
        {
          "txCount": number,
          "totalAmount": number,
          "maxSingleTx": number,
          "txBelowThreshold": number,  // count of txs between ₹40,000 and ₹49,999
          "rapidSequenceDetected": boolean,
          "signals": [string]
        }
    """
    try:
        transactions = json.loads(transactions_json)
    except (json.JSONDecodeError, TypeError):
        return json.dumps({"error": "Invalid transaction JSON", "txCount": 0, "signals": []})

    if not transactions:
        return json.dumps({
            "txCount": 0,
            "totalAmount": 0,
            "maxSingleTx": 0,
            "txBelowThreshold": 0,
            "rapidSequenceDetected": False,
            "signals": ["No transactions in window"]
        })

    amounts = [float(t.get("amount", 0)) for t in transactions]
    total = sum(amounts)
    max_tx = max(amounts) if amounts else 0
    # Count transactions that look like structuring attempts (just below ₹50k threshold)
    below_threshold = sum(1 for a in amounts if 40000 <= a < 50000)
    rapid_sequence = len(amounts) >= 3

    signals = []
    if below_threshold >= 2:
        signals.append(f"{below_threshold} transactions just below ₹50,000 threshold — possible structuring")
    if rapid_sequence:
        signals.append(f"{len(amounts)} transactions in 48 hours — high frequency")
    if total > 200000:
        signals.append(f"Total ₹{total:,.0f} in 48h exceeds ₹2,00,000 monitoring threshold")
    if max_tx > 1000000:
        signals.append(f"Single transaction of ₹{max_tx:,.0f} above ₹10,00,000 — mandatory reporting")
    if not signals:
        signals.append("No suspicious patterns detected in transaction history")

    return json.dumps({
        "txCount": len(amounts),
        "totalAmount": total,
        "maxSingleTx": max_tx,
        "txBelowThreshold": below_threshold,
        "rapidSequenceDetected": rapid_sequence,
        "signals": signals
    })
