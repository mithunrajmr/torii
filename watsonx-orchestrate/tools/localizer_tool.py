"""
localizer_tool.py
Tool used by the Localizer agent to detect language and pre-process
voice/text input from the kiosk before it reaches the Orchestrator.

Imported into watsonx Orchestrate via:
  orchestrate tools import -k python -f tools/localizer_tool.py
"""

from ibm_watsonx_orchestrate.agent_builder.tools import tool
import json
import re


# ---------------------------------------------------------------------------
# Supported languages — ISO 639-1 codes with display names.
# The kiosk targets Indian languages spoken in urban/semi-urban branches.
# ---------------------------------------------------------------------------
SUPPORTED_LANGUAGES = {
    "en": "English",
    "hi": "Hindi",
    "ta": "Tamil",
    "te": "Telugu",
    "kn": "Kannada",
    "mr": "Marathi",
    "bn": "Bengali",
    "gu": "Gujarati",
    "pa": "Punjabi",
    "ml": "Malayalam",
}

# Simple script-based language detection signals
_SCRIPT_HINTS = {
    "hi": re.compile(r'[\u0900-\u097F]'),   # Devanagari
    "ta": re.compile(r'[\u0B80-\u0BFF]'),   # Tamil
    "te": re.compile(r'[\u0C00-\u0C7F]'),   # Telugu
    "kn": re.compile(r'[\u0C80-\u0CFF]'),   # Kannada
    "mr": re.compile(r'[\u0900-\u097F]'),   # Devanagari (shared with Hindi)
    "bn": re.compile(r'[\u0980-\u09FF]'),   # Bengali
    "gu": re.compile(r'[\u0A80-\u0AFF]'),   # Gujarati
    "pa": re.compile(r'[\u0A00-\u0A7F]'),   # Gurmukhi
    "ml": re.compile(r'[\u0D00-\u0D7F]'),   # Malayalam
}

# Common PII patterns to redact before passing to the Orchestrator
_PII_PATTERNS = [
    # PAN number: AAAAA9999A
    (re.compile(r'\b[A-Z]{5}[0-9]{4}[A-Z]\b'), '[PAN_REDACTED]'),
    # Aadhaar: 12-digit number (with or without spaces/dashes)
    (re.compile(r'\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b'), '[AADHAAR_REDACTED]'),
    # Mobile number: 10-digit Indian mobile
    (re.compile(r'\b[6-9]\d{9}\b'), '[MOBILE_REDACTED]'),
    # Account number: 9–18 digit numeric string
    (re.compile(r'\b\d{9,18}\b'), '[ACCOUNT_REDACTED]'),
]


def _detect_language(text: str) -> str:
    """Detect the script/language of the input text. Returns ISO 639-1 code."""
    for lang_code, pattern in _SCRIPT_HINTS.items():
        if pattern.search(text):
            # Distinguish Hindi vs Marathi by common words (shallow heuristic)
            if lang_code == "hi" and any(w in text for w in ["आहे", "नाही", "मला", "माझे"]):
                return "mr"
            return lang_code
    return "en"  # Default to English for Latin script or undetected


def _redact_pii(text: str) -> tuple[str, list[str]]:
    """Redact PII tokens from text. Returns (redacted_text, list_of_types_redacted)."""
    redacted = text
    found_types = []
    for pattern, replacement in _PII_PATTERNS:
        if pattern.search(redacted):
            found_types.append(replacement.strip('[]'))
            redacted = pattern.sub(replacement, redacted)
    return redacted, found_types


@tool
def process_kiosk_input(raw_text: str, declared_language: str = "auto") -> str:
    """
    Pre-process raw voice/text input from the kiosk before routing to the Orchestrator.

    Performs three operations in sequence:
    1. Language detection (if declared_language is "auto")
    2. PII redaction (masks PAN, Aadhaar, mobile, account numbers)
    3. Returns cleaned, safe-to-route text with metadata

    Args:
        raw_text: The raw transcribed text from the kiosk voice input or typed query.
        declared_language: ISO 639-1 language code if known (e.g. "hi", "ta").
                           Pass "auto" to let the tool detect it automatically.

    Returns:
        JSON string:
        {
          "clean_text": "<PII-redacted text, safe to pass to Orchestrator>",
          "detected_language": "en|hi|ta|...",
          "language_name": "English|Hindi|Tamil|...",
          "pii_redacted": ["PAN_REDACTED", ...],   // list of PII types found and masked
          "is_supported_language": true|false,
          "original_length": 42,
          "clean_length": 35
        }
    """
    if not raw_text or not raw_text.strip():
        return json.dumps({
            "clean_text": "",
            "detected_language": "en",
            "language_name": "English",
            "pii_redacted": [],
            "is_supported_language": True,
            "original_length": 0,
            "clean_length": 0,
            "error": "Empty input received"
        })

    raw_text = raw_text.strip()

    # Step 1: Language detection
    lang_code = declared_language if declared_language != "auto" else _detect_language(raw_text)
    lang_name = SUPPORTED_LANGUAGES.get(lang_code, "Unknown")
    is_supported = lang_code in SUPPORTED_LANGUAGES

    # Step 2: PII redaction
    clean_text, pii_found = _redact_pii(raw_text)

    return json.dumps({
        "clean_text": clean_text,
        "detected_language": lang_code,
        "language_name": lang_name,
        "pii_redacted": pii_found,
        "is_supported_language": is_supported,
        "original_length": len(raw_text),
        "clean_length": len(clean_text),
    })


@tool
def translate_response_to_language(english_text: str, target_language: str) -> str:
    """
    Prepare a translation instruction for converting an English agent response
    to the customer's preferred language.

    In the current implementation this returns a structured instruction object
    that the Localizer agent's LLM (Granite) uses to produce the translation.
    A production deployment would call the IBM Language Translator service here.

    Args:
        english_text: The English-language response to translate.
        target_language: ISO 639-1 target language code (e.g. "hi", "ta").

    Returns:
        JSON string:
        {
          "source_text": "<original English>",
          "target_language": "hi",
          "target_language_name": "Hindi",
          "instruction": "<prompt instruction for the LLM to perform translation>",
          "needs_translation": true|false
        }
    """
    if not english_text:
        return json.dumps({"error": "No text to translate", "needs_translation": False})

    lang_name = SUPPORTED_LANGUAGES.get(target_language, "English")
    needs_translation = target_language != "en" and target_language in SUPPORTED_LANGUAGES

    instruction = (
        f"Translate the following text from English to {lang_name}. "
        f"Keep banking terms (NEFT, RTGS, PAN, KYC, FD, EMI) in English. "
        f"Keep all numbers, currency amounts (₹), and percentages as-is. "
        f"Use simple, clear language appropriate for a bank customer. "
        f"Return ONLY the translated text, no explanation:\n\n{english_text}"
        if needs_translation
        else english_text
    )

    return json.dumps({
        "source_text": english_text,
        "target_language": target_language,
        "target_language_name": lang_name,
        "instruction": instruction,
        "needs_translation": needs_translation,
    })
