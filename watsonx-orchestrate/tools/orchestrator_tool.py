"""
orchestrator_tool.py
Tool used by the Master Orchestrator agent to classify customer intent
and route to the correct downstream agent or flow.

Imported into watsonx Orchestrate via:
  orchestrate tools import -k python -f tools/orchestrator_tool.py
"""

from ibm_watsonx_orchestrate.agent_builder.tools import tool
import json
import re


# ---------------------------------------------------------------------------
# Intent definitions — each intent maps to a downstream handler.
# ---------------------------------------------------------------------------
INTENTS = {
    "PAN_MISSING": {
        "description": "Customer's transaction failed due to missing/unlinked PAN card",
        "downstream": "mobile_qr_handoff",
        "keywords": [
            "pan", "kyc", "transaction failed", "transaction blocked",
            "50000", "50k", "link pan", "upload pan", "pan card",
            "err_pan", "failed deposit", "couldn't transfer"
        ],
    },
    "FAQ_QUERY": {
        "description": "Customer has a general banking question or needs policy information",
        "downstream": "faq_rag_agent",
        "keywords": [
            "what is", "how do i", "how to", "can i", "when", "timing",
            "limit", "interest rate", "charges", "fee", "apply", "open account",
            "close account", "home loan", "personal loan", "fd", "fixed deposit",
            "minimum balance", "neft", "rtgs", "imps", "upi", "credit card",
            "debit card", "block card", "lost card", "branch hours", "helpline",
            "contact", "complaint", "grievance", "documents needed"
        ],
    },
    "ACCOUNT_STATUS": {
        "description": "Customer wants to check their account balance, recent transactions or status",
        "downstream": "account_inquiry",
        "keywords": [
            "balance", "check balance", "account balance", "my account",
            "recent transactions", "statement", "passbook", "mini statement",
            "last transaction", "how much"
        ],
    },
    "GENERAL_TRIAGE": {
        "description": "Customer has an unrecognised or complex issue requiring human teller",
        "downstream": "teller_escalation",
        "keywords": [],  # Catch-all — matched when no other intent scores above threshold
    },
}

INTENT_CONFIDENCE_THRESHOLD = 0.15


def _classify_intent(text: str) -> dict:
    """Score all intents against the input text and return the best match."""
    text_lower = text.lower()
    tokens = set(re.findall(r'\w+', text_lower))

    scores = {}
    for intent_name, intent_data in INTENTS.items():
        if not intent_data["keywords"]:
            scores[intent_name] = 0.0
            continue

        matches = sum(
            1 for kw in intent_data["keywords"]
            if kw in text_lower or any(kw in tok or tok in kw for tok in tokens)
        )
        scores[intent_name] = matches / len(intent_data["keywords"])

    best_intent = max(scores, key=lambda k: scores[k])
    best_score = scores[best_intent]

    # Fall back to GENERAL_TRIAGE if no intent meets the threshold
    if best_score < INTENT_CONFIDENCE_THRESHOLD:
        best_intent = "GENERAL_TRIAGE"
        best_score = 0.0

    return {
        "intent": best_intent,
        "confidence": round(best_score, 3),
        "all_scores": {k: round(v, 3) for k, v in scores.items()},
        "downstream": INTENTS[best_intent]["downstream"],
        "description": INTENTS[best_intent]["description"],
    }


@tool
def classify_customer_intent(clean_text: str, account_context: str = "{}") -> str:
    """
    Classify the customer's intent from their kiosk input and determine
    which downstream agent or workflow should handle the request.

    This is the routing brain of the Master Orchestrator. It combines
    keyword-based intent scoring with account context (e.g. known failed
    transactions) to produce the most accurate routing decision.

    Args:
        clean_text: PII-redacted customer query text (from Localizer agent output).
        account_context: JSON string with optional account context flags:
          {
            "has_failed_pan_tx": boolean,   // backend found ERR_PAN_MISSING_OVER_50K
            "account_number": "[REDACTED]", // for reference only, not used in scoring
            "recent_error_code": "ERR_PAN_MISSING_OVER_50K | null"
          }

    Returns:
        JSON string:
        {
          "intent": "PAN_MISSING | FAQ_QUERY | ACCOUNT_STATUS | GENERAL_TRIAGE",
          "confidence": 0.75,
          "downstream": "mobile_qr_handoff | faq_rag_agent | account_inquiry | teller_escalation",
          "description": "Human-readable explanation of routing decision",
          "context_override": true|false,   // true if account_context forced the intent
          "suggested_response_prefix": "..."
        }
    """
    if not clean_text or not clean_text.strip():
        return json.dumps({
            "intent": "GENERAL_TRIAGE",
            "confidence": 0.0,
            "downstream": "teller_escalation",
            "description": "Empty input — routing to general triage",
            "context_override": False,
            "suggested_response_prefix": "How can I help you today?",
        })

    # Parse account context
    try:
        ctx = json.loads(account_context) if account_context else {}
    except (json.JSONDecodeError, TypeError):
        ctx = {}

    # Context override: if the backend already knows the customer has a PAN failure,
    # bias strongly toward PAN_MISSING regardless of their text
    context_override = False
    if ctx.get("has_failed_pan_tx") or ctx.get("recent_error_code") == "ERR_PAN_MISSING_OVER_50K":
        classification = {
            "intent": "PAN_MISSING",
            "confidence": 0.95,
            "downstream": "mobile_qr_handoff",
            "description": "Account has a recent PAN-missing transaction failure — routing to mobile QR handoff",
        }
        context_override = True
    else:
        classification = _classify_intent(clean_text)

    # Build a suggested response prefix for the TTS voice greeting
    prefixes = {
        "PAN_MISSING": "I can see your recent transaction was blocked. Let me help you fix that right now.",
        "FAQ_QUERY": "Great question! Let me look that up for you.",
        "ACCOUNT_STATUS": "Let me pull up your account information.",
        "GENERAL_TRIAGE": "I'll connect you with a teller who can help you with this.",
    }

    return json.dumps({
        "intent": classification["intent"],
        "confidence": classification["confidence"],
        "downstream": classification["downstream"],
        "description": classification["description"],
        "context_override": context_override,
        "suggested_response_prefix": prefixes.get(classification["intent"], "How can I help?"),
    })
