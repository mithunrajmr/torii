"""
translate_response_tool.py
Tool used by the Localizer agent to translate English responses
back to the customer's preferred language.

Imported into watsonx Orchestrate via:
  orchestrate tools import -k python -f tools/translate_response_tool.py
"""

from ibm_watsonx_orchestrate.agent_builder.tools import tool
import json

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
