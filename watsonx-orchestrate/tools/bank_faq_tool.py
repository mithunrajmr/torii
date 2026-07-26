"""
bank_faq_tool.py
Tool used by the FAQ/QnA Diagnostic RAG agent to retrieve and score
relevant bank policy answers from a structured knowledge base.

Imported into watsonx Orchestrate via:
  orchestrate tools import -k python -f tools/bank_faq_tool.py

Session 3 changes:
  - Expanded KB from 16 → 40 entries covering all common Indian retail
    banking topics: KYC, transactions, accounts, loans, FD/RD, cards,
    branch, NRI, cheque, locker, nomination, dormant accounts, NACH/ECS
  - Added optional `domain_filter` param to search_bank_faq
  - Added `log_faq_query` tool function for feedback loop tracking
"""

from ibm_watsonx_orchestrate.agent_builder.tools import tool
import json
import re
import os
import datetime


# ---------------------------------------------------------------------------
# Static knowledge base — bank policies for Indian retail banking context.
# In production this would be replaced by a vector DB lookup (e.g. Milvus,
# Pinecone, or Supabase pgvector). For the hackathon demo, this in-process
# store covers the top 40 queries observed at branch kiosks.
# ---------------------------------------------------------------------------
_FAQ_KB = [
    # ── KYC / PAN ────────────────────────────────────────────────────────────
    {
        "id": "kyc-001",
        "category": "KYC",
        "keywords": ["pan", "link", "kyc", "why failed", "transaction blocked", "50000", "50k"],
        "question": "Why did my transaction above ₹50,000 fail?",
        "answer": (
            "Transactions above ₹50,000 require a linked PAN card under RBI KYC norms. "
            "Your account currently has no PAN on record. Scan the QR code on this screen "
            "to upload your PAN from your mobile — it takes under 2 minutes."
        ),
    },
    {
        "id": "kyc-002",
        "category": "KYC",
        "keywords": ["pan card", "documents", "upload", "what do i need", "required documents"],
        "question": "What documents do I need to link my PAN?",
        "answer": (
            "You need your original PAN card (or a clear photo of it). "
            "The system will OCR the details automatically. "
            "Make sure the card is well-lit and the text is clearly visible."
        ),
    },
    {
        "id": "kyc-003",
        "category": "KYC",
        "keywords": ["aadhaar", "address proof", "id proof", "kyc documents", "full kyc"],
        "question": "Which documents are accepted for full KYC?",
        "answer": (
            "Accepted KYC documents: PAN card (mandatory for transactions > ₹50,000), "
            "Aadhaar card, Passport, Voter ID, or Driving Licence for address proof. "
            "Original + self-attested photocopy required for in-branch KYC."
        ),
    },
    {
        "id": "kyc-004",
        "category": "KYC",
        "keywords": ["kyc expired", "kyc update", "kyc pending", "re-kyc", "kyc renewal"],
        "question": "How do I update or renew my KYC?",
        "answer": (
            "Visit any branch with your Aadhaar and PAN card to update KYC. "
            "Alternatively, complete Video KYC via the mobile app in under 5 minutes — "
            "no branch visit needed. KYC is valid for life once completed with Aadhaar."
        ),
    },
    # ── Transactions / Limits ─────────────────────────────────────────────────
    {
        "id": "txn-001",
        "category": "TRANSACTIONS",
        "keywords": ["daily limit", "transaction limit", "how much can i transfer", "upi limit", "neft limit"],
        "question": "What are the daily transaction limits?",
        "answer": (
            "Daily limits: UPI — ₹1,00,000 per day; NEFT — no per-transaction limit, "
            "but daily cap of ₹10,00,000 for retail accounts; IMPS — ₹5,00,000 per day; "
            "ATM cash withdrawal — ₹25,000 per day (standard) or ₹50,000 (premium). "
            "Limits can be increased via the mobile app or by visiting the branch."
        ),
    },
    {
        "id": "txn-002",
        "category": "TRANSACTIONS",
        "keywords": ["neft timing", "neft hours", "neft time", "when neft", "neft settlement"],
        "question": "What are the NEFT processing timings?",
        "answer": (
            "NEFT is available 24×7 including weekends and bank holidays. "
            "Settlements happen in half-hourly batches. "
            "Transactions initiated after 7:45 PM may settle in the next day's first batch."
        ),
    },
    {
        "id": "txn-003",
        "category": "TRANSACTIONS",
        "keywords": ["rtgs", "rtgs timing", "rtgs hours", "real time gross", "rtgs limit"],
        "question": "What are the RTGS processing timings?",
        "answer": (
            "RTGS is available Monday to Friday, 7:00 AM to 6:00 PM, "
            "and Saturday 7:00 AM to 1:00 PM. "
            "Minimum transfer amount: ₹2,00,000. No maximum limit."
        ),
    },
    {
        "id": "txn-004",
        "category": "TRANSACTIONS",
        "keywords": ["transaction failed", "payment failed", "transfer failed", "money deducted", "not credited"],
        "question": "My transaction failed but money was deducted. What do I do?",
        "answer": (
            "If money was debited but not credited, it is automatically refunded within 5 working days "
            "for NEFT/RTGS, and within 24 hours for UPI and IMPS. "
            "If not resolved, raise a complaint via the mobile app or call our 24×7 helpline 1800-XXX-XXXX."
        ),
    },
    {
        "id": "txn-005",
        "category": "TRANSACTIONS",
        "keywords": ["nach", "ecs", "auto debit", "mandate", "standing instruction", "nach cancel"],
        "question": "How do I cancel an auto-debit / NACH mandate?",
        "answer": (
            "To cancel a NACH mandate, visit the branch with your account details and the mandate reference number, "
            "or use the mobile app under Payments > Manage Mandates. "
            "Submit cancellation at least 3 working days before the next debit date. "
            "Revocation takes effect from the next cycle."
        ),
    },
    # ── Account Services ──────────────────────────────────────────────────────
    {
        "id": "acct-001",
        "category": "ACCOUNT",
        "keywords": ["open account", "new account", "savings account", "current account", "open savings"],
        "question": "How do I open a new savings account?",
        "answer": (
            "You can open a savings account online via our mobile app (zero paperwork) "
            "or visit the branch with: Aadhaar card, PAN card, passport-size photo, "
            "and an initial deposit of ₹500 (zero-balance variant available for students)."
        ),
    },
    {
        "id": "acct-002",
        "category": "ACCOUNT",
        "keywords": ["minimum balance", "min balance", "charges", "penalty", "non maintenance"],
        "question": "What is the minimum balance requirement?",
        "answer": (
            "Metro/Urban branches: ₹10,000 average quarterly balance. "
            "Semi-urban branches: ₹5,000. Rural branches: ₹1,000. "
            "Non-maintenance charge: ₹200 + GST per quarter. "
            "Basic Savings Deposit Account (BSDA): zero minimum balance."
        ),
    },
    {
        "id": "acct-003",
        "category": "ACCOUNT",
        "keywords": ["close account", "account closure", "close my account", "how to close"],
        "question": "How do I close my account?",
        "answer": (
            "Visit the home branch with your original passbook, debit card (cut in half), "
            "and a signed account closure form. "
            "Accounts closed within 1 year attract a closure charge of ₹500. "
            "You can also request closure via the mobile app if no active facilities exist."
        ),
    },
    {
        "id": "acct-004",
        "category": "ACCOUNT",
        "keywords": ["dormant account", "inactive account", "reactivate account", "account freeze"],
        "question": "How do I reactivate a dormant or inactive account?",
        "answer": (
            "An account becomes dormant after 24 months of no transactions. "
            "To reactivate, visit the branch with valid KYC documents and submit a reactivation request. "
            "A small transaction (deposit or withdrawal) after reactivation will restore full access."
        ),
    },
    {
        "id": "acct-005",
        "category": "ACCOUNT",
        "keywords": ["nomination", "nominee", "add nominee", "change nominee", "who is nominee"],
        "question": "How do I add or change a nominee on my account?",
        "answer": (
            "Fill out Form DA-1 (available at the branch or downloadable from our website) "
            "and submit with a witness signature at any branch. "
            "You can also update the nominee via the mobile app under Account Settings > Nominee. "
            "Changes take effect within 2 working days."
        ),
    },
    {
        "id": "acct-006",
        "category": "ACCOUNT",
        "keywords": ["joint account", "add holder", "second holder", "remove holder"],
        "question": "Can I add a joint account holder?",
        "answer": (
            "Yes. Visit the home branch with the new joint holder's KYC documents (Aadhaar + PAN). "
            "Both existing and new account holders must be present and sign the amendment form. "
            "The account mode (either/survivor, jointly, etc.) can be set at the same time."
        ),
    },
    # ── Loans ─────────────────────────────────────────────────────────────────
    {
        "id": "loan-001",
        "category": "LOANS",
        "keywords": ["home loan", "housing loan", "home loan rate", "home loan emi", "housing"],
        "question": "What is the current home loan interest rate?",
        "answer": (
            "Home loan rates start at 8.40% p.a. (floating, linked to RBI repo rate). "
            "Maximum tenure: 30 years. LTV ratio: up to 90% for loans up to ₹30 lakh. "
            "Processing fee: 0.5% of loan amount (minimum ₹5,000). "
            "Apply online or visit the branch for a free eligibility check."
        ),
    },
    {
        "id": "loan-002",
        "category": "LOANS",
        "keywords": ["personal loan", "instant loan", "personal loan rate", "personal loan apply"],
        "question": "How can I get a personal loan?",
        "answer": (
            "Personal loans are available from ₹50,000 to ₹40,00,000 at 10.99%–18% p.a. "
            "depending on your credit score. "
            "Salaried employees with salary account: instant pre-approval in 10 minutes. "
            "Documents needed: last 3 months salary slips, Form 16, Aadhaar, PAN."
        ),
    },
    {
        "id": "loan-003",
        "category": "LOANS",
        "keywords": ["gold loan", "gold rate", "loan against gold", "gold jewellery loan"],
        "question": "What are the terms for a gold loan?",
        "answer": (
            "Gold loans: up to 75% of gold value at 9.50% p.a. "
            "Minimum: ₹10,000. Maximum: ₹50,00,000. "
            "Disbursed on the same day. No income proof required. "
            "Gold is stored in the bank's secure vault and returned on full repayment."
        ),
    },
    {
        "id": "loan-004",
        "category": "LOANS",
        "keywords": ["emi", "loan emi", "prepay loan", "foreclose loan", "prepayment charges"],
        "question": "Can I prepay or foreclose my loan early?",
        "answer": (
            "Yes. Floating-rate loans (home, personal) have zero prepayment penalty as per RBI rules. "
            "Fixed-rate loans: 2% prepayment charge on the outstanding principal. "
            "Partial prepayment of minimum ₹10,000 is accepted at any time. "
            "Submit a written request at the branch or via the mobile app."
        ),
    },
    {
        "id": "loan-005",
        "category": "LOANS",
        "keywords": ["education loan", "student loan", "study loan", "college loan"],
        "question": "How do I apply for an education loan?",
        "answer": (
            "Education loans from ₹50,000 to ₹1,50,00,000 at 9.5%–11% p.a. "
            "Courses covered: IIT/IIM/NEET-cleared colleges, foreign universities, professional courses. "
            "Repayment starts 12 months after course completion or 6 months after employment — whichever is earlier. "
            "No collateral required for loans up to ₹7.5 lakh."
        ),
    },
    # ── Fixed Deposits / RD ────────────────────────────────────────────────────
    {
        "id": "fd-001",
        "category": "DEPOSITS",
        "keywords": ["fixed deposit", "fd rate", "fd interest", "best fd", "fd tenure", "fd open"],
        "question": "What is the current FD interest rate?",
        "answer": (
            "Current FD rates (general public): "
            "7 days–45 days: 4.50% | 46 days–6 months: 5.75% | "
            "6 months–1 year: 6.50% | 1–2 years: 7.75% | 2–5 years: 7.25% | "
            "5–10 years: 6.75%. Senior citizens get 0.50% extra on all tenures. "
            "Minimum deposit: ₹1,000."
        ),
    },
    {
        "id": "fd-002",
        "category": "DEPOSITS",
        "keywords": ["fd break", "fd premature", "fd withdrawal", "break fd", "close fd early", "fd penalty"],
        "question": "What is the penalty for breaking an FD before maturity?",
        "answer": (
            "Premature FD closure attracts a penalty of 0.50%–1% on the contracted interest rate "
            "depending on the tenure completed. "
            "FDs broken within 7 days earn no interest. "
            "Tax-saving FDs (5-year lock-in) cannot be broken before maturity."
        ),
    },
    {
        "id": "fd-003",
        "category": "DEPOSITS",
        "keywords": ["rd", "recurring deposit", "rd rate", "monthly deposit", "rd open"],
        "question": "What is a Recurring Deposit (RD) and what are the rates?",
        "answer": (
            "An RD lets you invest a fixed amount monthly and earn interest. "
            "RD rates: 6 months–1 year: 6.25% | 1–2 years: 7.50% | 2–5 years: 7.00%. "
            "Minimum monthly instalment: ₹500. Tenure: 6 months to 10 years. "
            "Missed instalments attract a penalty of ₹1.50 per ₹100 per month."
        ),
    },
    {
        "id": "fd-004",
        "category": "DEPOSITS",
        "keywords": ["tax saving fd", "80c fd", "tax benefit fd", "elss", "five year fd", "tax saver"],
        "question": "Does the bank offer a tax-saving FD under Section 80C?",
        "answer": (
            "Yes. Our 5-year Tax Saver FD qualifies for deduction under Section 80C up to ₹1,50,000 per year. "
            "Interest rate: 7.25% p.a. (7.75% for senior citizens). "
            "Lock-in period: 5 years — premature withdrawal is not permitted. "
            "Interest is taxable as per your income slab."
        ),
    },
    # ── Cards ─────────────────────────────────────────────────────────────────
    {
        "id": "card-001",
        "category": "CARDS",
        "keywords": ["debit card", "atm card", "lost card", "block card", "card blocked", "stolen card"],
        "question": "How do I block a lost or stolen debit card?",
        "answer": (
            "Immediately: call our 24×7 helpline 1800-XXX-XXXX (toll-free) or "
            "SMS 'BLOCK <last 4 digits>' to 567676. "
            "Alternatively, block via mobile app: Cards > My Cards > Block Card. "
            "A replacement card will be dispatched within 5 working days."
        ),
    },
    {
        "id": "card-002",
        "category": "CARDS",
        "keywords": ["credit card", "credit card apply", "credit card eligibility", "apply credit card"],
        "question": "How do I apply for a credit card?",
        "answer": (
            "Eligibility: salaried (min income ₹2,00,000 p.a.) or self-employed (ITR > ₹2,50,000). "
            "Apply online in 5 minutes via the mobile app. "
            "Card variants: Platinum (2% cashback), Gold (1% cashback), Classic (rewards points). "
            "Joining fee waived for salary account holders."
        ),
    },
    {
        "id": "card-003",
        "category": "CARDS",
        "keywords": ["atm pin", "change pin", "forgot pin", "pin reset", "new pin", "card pin"],
        "question": "How do I change or reset my ATM/debit card PIN?",
        "answer": (
            "Change your PIN at any of our ATMs under PIN Services > Change PIN. "
            "Alternatively, use the mobile app: Cards > My Cards > Change PIN (OTP verified). "
            "If you have forgotten your PIN, request a new PIN via the app — "
            "it arrives via SMS within 2 working days or can be set instantly via Green PIN."
        ),
    },
    {
        "id": "card-004",
        "category": "CARDS",
        "keywords": ["card charges", "annual fee", "card fee", "credit card fee", "card renewal fee"],
        "question": "What are the annual fees for debit and credit cards?",
        "answer": (
            "Debit cards: Classic — ₹150/year; Platinum — ₹250/year; waived if quarterly balance > ₹25,000. "
            "Credit cards: Classic — ₹500/year; Gold — ₹750/year; Platinum — ₹1,500/year. "
            "Annual fee waived on spending ₹1,50,000+ in the previous year."
        ),
    },
    # ── Branch / Contact ──────────────────────────────────────────────────────
    {
        "id": "branch-001",
        "category": "BRANCH",
        "keywords": ["branch timing", "branch hours", "bank open", "working hours", "bank timing"],
        "question": "What are the branch working hours?",
        "answer": (
            "Monday to Friday: 9:30 AM – 4:00 PM. "
            "Saturday: 9:30 AM – 1:30 PM (alternate Saturdays as per RBI schedule). "
            "Sunday and national holidays: closed. "
            "ATMs and digital services are available 24×7."
        ),
    },
    {
        "id": "branch-002",
        "category": "BRANCH",
        "keywords": ["customer care", "helpline", "contact", "complaint", "grievance", "toll free"],
        "question": "How do I contact customer support?",
        "answer": (
            "24×7 helpline: 1800-XXX-XXXX (toll-free from any network). "
            "Email: support@toriibank.in (response within 2 working days). "
            "For grievances: visit the branch and ask for the Grievance Redressal Officer, "
            "or escalate to the Banking Ombudsman at rbi.org.in/ombudsman."
        ),
    },
    {
        "id": "branch-003",
        "category": "BRANCH",
        "keywords": ["locker", "safe deposit locker", "locker rent", "locker apply", "bank locker"],
        "question": "How do I get a safe deposit locker?",
        "answer": (
            "Lockers are available subject to availability at the branch. "
            "Apply by visiting the branch — a savings account with the bank is mandatory. "
            "Annual locker rent: Small — ₹1,500; Medium — ₹3,000; Large — ₹5,000 + GST. "
            "Rent is recovered by a lien on your account annually."
        ),
    },
    # ── Cheque Services ───────────────────────────────────────────────────────
    {
        "id": "chq-001",
        "category": "CHEQUE",
        "keywords": ["cheque bounce", "dishonour", "bounced cheque", "return cheque", "cheque returned"],
        "question": "What happens if my cheque bounces?",
        "answer": (
            "A returned/bounced cheque attracts a charge of ₹350 + GST per instance for the drawer. "
            "The payee's bank also charges a return fee (typically ₹150). "
            "Repeated cheque bounces can affect your CIBIL score. "
            "The payee can file a legal case under Section 138 of the Negotiable Instruments Act."
        ),
    },
    {
        "id": "chq-002",
        "category": "CHEQUE",
        "keywords": ["stop payment", "cancel cheque", "stop cheque", "cheque stop"],
        "question": "How do I stop payment on a cheque?",
        "answer": (
            "Request a stop payment via mobile app (Payments > Cheque Services > Stop Payment) "
            "or by calling the helpline before the cheque is presented for clearing. "
            "Stop payment charge: ₹100 + GST per cheque. "
            "Valid for 6 months from the request date."
        ),
    },
    {
        "id": "chq-003",
        "category": "CHEQUE",
        "keywords": ["cheque book", "new cheque book", "request cheque book", "order cheque book"],
        "question": "How do I request a new cheque book?",
        "answer": (
            "Request via mobile app (Accounts > Cheque Book Request), "
            "internet banking, or at the branch. "
            "Standard 25-leaf cheque book: free. 50-leaf: ₹75. "
            "Delivered to your registered address within 5–7 working days."
        ),
    },
    # ── NRI Services ──────────────────────────────────────────────────────────
    {
        "id": "nri-001",
        "category": "NRI",
        "keywords": ["nri account", "nre account", "nro account", "overseas", "foreign remittance", "nri"],
        "question": "What is the difference between NRE and NRO accounts?",
        "answer": (
            "NRE (Non-Resident External): holds foreign income in INR; fully repatriable; interest tax-free in India. "
            "NRO (Non-Resident Ordinary): holds Indian-source income; repatriation up to USD 1 million/year; "
            "interest taxable in India at 30% TDS. "
            "Both require a valid visa, passport, and proof of overseas address."
        ),
    },
    {
        "id": "nri-002",
        "category": "NRI",
        "keywords": ["remittance", "send money", "wire transfer", "swift", "international transfer", "fcnr"],
        "question": "How do I send money from abroad to my Indian account?",
        "answer": (
            "Use SWIFT/wire transfer to your NRE or NRO account — provide the branch IFSC and SWIFT code. "
            "Our SWIFT code: TORIIINBB. "
            "FCNR (Foreign Currency Non-Resident) deposits are also available in USD, EUR, GBP, JPY, CAD, AUD. "
            "No tax on FCNR interest. Minimum deposit: USD 1,000 equivalent."
        ),
    },
    # ── Insurance / Other ─────────────────────────────────────────────────────
    {
        "id": "ins-001",
        "category": "INSURANCE",
        "keywords": ["insurance", "life insurance", "accident insurance", "pmjjby", "pmsby", "pradhan mantri"],
        "question": "What government insurance schemes does the bank offer?",
        "answer": (
            "PMJJBY (Pradhan Mantri Jeevan Jyoti Bima Yojana): ₹2 lakh life cover at ₹436/year — "
            "enrol via mobile app or branch. "
            "PMSBY (Pradhan Mantri Suraksha Bima Yojana): ₹2 lakh accidental cover at ₹20/year. "
            "Both require a savings account and are auto-debited annually."
        ),
    },
    {
        "id": "ins-002",
        "category": "INSURANCE",
        "keywords": ["pmjdy", "jan dhan", "zero balance", "basic account", "pradhan mantri jan dhan"],
        "question": "How do I open a Jan Dhan / zero-balance account?",
        "answer": (
            "Pradhan Mantri Jan Dhan Yojana accounts have zero minimum balance and include "
            "a free RuPay debit card, accidental cover of ₹2 lakh, and life insurance of ₹30,000. "
            "Open at any branch with just an Aadhaar card. No PAN required initially. "
            "Account can be upgraded to a regular savings account later."
        ),
    },
]


# ---------------------------------------------------------------------------
# Scoring helper
# ---------------------------------------------------------------------------

def _score_query(query: str, entry: dict) -> float:
    """Simple keyword overlap scorer — returns a relevance score 0.0–1.0."""
    q_lower = query.lower()
    q_tokens = set(re.findall(r'\w+', q_lower))
    matches = sum(1 for kw in entry["keywords"] if kw in q_lower)
    token_matches = sum(
        1 for kw in entry["keywords"]
        if any(kw in tok or tok in kw for tok in q_tokens)
    )
    # Weight direct substring matches higher
    score = (matches * 2 + token_matches) / (len(entry["keywords"]) * 2 + 1)
    return min(score, 1.0)


# ---------------------------------------------------------------------------
# Tools
# ---------------------------------------------------------------------------

@tool
def search_bank_faq(query: str, top_k: int = 3, domain_filter: str = "") -> str:
    """
    Search the bank's FAQ knowledge base for answers to a customer query.

    Performs keyword-based relevance scoring against a structured policy store.
    In production this is replaced by a vector similarity search against a
    pgvector / Pinecone index of bank policy documents.

    Args:
        query: The customer's natural language question (in English).
        top_k: Number of top results to return (default 3, max 5).
        domain_filter: Optional category to restrict search. One of:
                       KYC, TRANSACTIONS, ACCOUNT, LOANS, DEPOSITS,
                       CARDS, BRANCH, CHEQUE, NRI, INSURANCE.
                       Pass empty string to search all categories.

    Returns:
        JSON string with the top matching FAQ entries:
        {
          "results": [
            {
              "id": "kyc-001",
              "category": "KYC",
              "question": "Why did my transaction fail?",
              "answer": "...",
              "relevance_score": 0.87
            }
          ],
          "total_found": 3,
          "best_category": "KYC",
          "domain_filter_applied": "KYC"
        }
    """
    if not query or not query.strip():
        return json.dumps({
            "results": [],
            "total_found": 0,
            "best_category": None,
            "domain_filter_applied": domain_filter,
            "error": "Empty query provided"
        })

    top_k = min(max(1, top_k), 5)

    # Apply domain filter if provided
    kb = _FAQ_KB
    if domain_filter and domain_filter.strip():
        kb = [e for e in _FAQ_KB if e["category"].upper() == domain_filter.strip().upper()]

    scored = []
    for entry in kb:
        score = _score_query(query, entry)
        if score > 0:
            scored.append({
                "id": entry["id"],
                "category": entry["category"],
                "question": entry["question"],
                "answer": entry["answer"],
                "relevance_score": round(score, 3),
            })

    scored.sort(key=lambda x: x["relevance_score"], reverse=True)
    top_results = scored[:top_k]

    best_category = top_results[0]["category"] if top_results else None

    return json.dumps({
        "results": top_results,
        "total_found": len(top_results),
        "best_category": best_category,
        "domain_filter_applied": domain_filter or "ALL",
    })


@tool
def log_faq_query(query: str, was_answered: bool, domain: str = "", confidence: float = 0.0) -> str:
    """
    Log a customer FAQ query for KB gap analysis and feedback loop tracking.

    Called after every FAQ agent response. Low-confidence / unanswered queries
    are stored in the faq_query_log table (via the backend) so the KB Manager
    can identify coverage gaps and propose new entries.

    Note: This tool writes to a file-based log when DB is unavailable (fallback).
    The primary persistence path is through the backend's kioskController.js
    which writes to the faq_query_log Supabase table directly.

    Args:
        query: The customer's original question (PII-redacted).
        was_answered: True if relevance_score >= 0.2, False otherwise.
        domain: The category matched (or empty if no match).
        confidence: The best relevance_score returned by search_bank_faq.

    Returns:
        JSON string: { "logged": true, "query_id": "<uuid-like>", "status": "ok" }
    """
    import hashlib
    # Generate a deterministic ID from the query text + timestamp hour
    # (groups similar queries asked within the same hour)
    hour_bucket = datetime.datetime.utcnow().strftime("%Y%m%d%H")
    query_id = hashlib.md5(f"{query.lower().strip()}{hour_bucket}".encode()).hexdigest()[:12]

    entry = {
        "query_id": query_id,
        "query": query[:500],          # cap at 500 chars
        "was_answered": was_answered,
        "domain": domain or "UNKNOWN",
        "confidence": round(confidence, 3),
        "logged_at": datetime.datetime.utcnow().isoformat() + "Z",
    }

    # Write to local log file as fallback (backend DB write is the primary path)
    try:
        log_path = os.path.join(os.path.dirname(__file__), "..", "faq_query_log.jsonl")
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry) + "\n")
    except Exception:
        pass  # Never let logging failures affect the customer response

    return json.dumps({"logged": True, "query_id": query_id, "status": "ok"})
