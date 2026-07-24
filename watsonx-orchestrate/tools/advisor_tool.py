"""
advisor_tool.py
Tool used by the Cross-Sell Advisor agent.
Imported into watsonx Orchestrate via: orchestrate tools import -f advisor_tool.py
"""

from ibm_watsonx_orchestrate.agent_builder.tools import tool
import json


@tool
def generate_cross_sell_offer(account_balance: float, preferred_language: str = "en") -> str:
    """
    Determine the appropriate product category for a customer based on their balance.
    The agent uses this context to craft a personalised offer message.

    Args:
        account_balance: Customer's current account balance in Indian Rupees.
        preferred_language: ISO language code for the response (default: 'en').

    Returns:
        JSON string with product category context and suggested talking points:
        {
          "balance_tier": "PREMIUM|STANDARD|ENTRY",
          "recommended_product": "FD|LOAN|INSURANCE|RD|WEALTH",
          "interest_rate_hint": string,
          "talking_points": [string]
        }
    """
    if account_balance >= 500000:
        tier = "PREMIUM"
        product = "WEALTH"
        rate_hint = "customised wealth management rates from 8.5% p.a."
        talking_points = [
            "Premium Fixed Deposit with guaranteed 8.5%+ p.a. returns",
            "Personalised wealth management portfolio review",
            "Priority banking with dedicated relationship manager"
        ]
    elif account_balance >= 50000:
        tier = "STANDARD"
        product = "FD"
        rate_hint = "7.75% p.a. on 12-month Fixed Deposit"
        talking_points = [
            "Lock in guaranteed 7.75% p.a. returns for 12 months",
            "Start with as low as ₹10,000",
            "Flexible tenure from 7 days to 10 years"
        ]
    else:
        tier = "ENTRY"
        product = "LOAN"
        rate_hint = "pre-approved personal credit from 10.99% p.a."
        talking_points = [
            "Instant pre-approved credit up to ₹1,00,000",
            "Zero documentation, disbursed in 24 hours",
            "Flexible EMI options from 6 to 60 months"
        ]

    return json.dumps({
        "balance_tier": tier,
        "recommended_product": product,
        "interest_rate_hint": rate_hint,
        "talking_points": talking_points,
        "language": preferred_language
    })
