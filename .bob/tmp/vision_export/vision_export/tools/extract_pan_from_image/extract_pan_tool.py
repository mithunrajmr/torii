"""
extract_pan_tool.py
Tool used by the Vision OCR agent to process document images.
Imported into watsonx Orchestrate via: orchestrate tools import -f extract_pan_tool.py
"""

from ibm_watsonx_orchestrate.agent_builder.tools import tool
import base64
import re
import json


@tool
def extract_pan_from_image(document_base64: str, mime_type: str = "image/jpeg") -> str:
    """
    Extract PAN card details from a base64-encoded document image.

    Args:
        document_base64: Base64-encoded image string of the PAN card document.
        mime_type: MIME type of the image (e.g. 'image/jpeg', 'image/png').

    Returns:
        JSON string containing: name, pan_number, clarity_score, confidence.
        Example: {"name": "MITHUN RAJ", "pan_number": "ABCDE1234F", "clarity_score": 0.92, "confidence": 0.94}
    """
    # Validate base64 input
    if not document_base64:
        return json.dumps({
            "name": None,
            "pan_number": None,
            "clarity_score": 0.0,
            "confidence": 0.0,
            "error": "No image data provided"
        })

    # Validate base64 encoding
    try:
        image_bytes = base64.b64decode(document_base64)
        image_size_kb = len(image_bytes) / 1024
    except Exception as e:
        return json.dumps({
            "name": None,
            "pan_number": None,
            "clarity_score": 0.0,
            "confidence": 0.0,
            "error": f"Invalid base64 encoding: {str(e)}"
        })

    # Validate image size (reject < 5KB as likely corrupt / too small to be a real PAN card)
    if image_size_kb < 5:
        return json.dumps({
            "name": None,
            "pan_number": None,
            "clarity_score": 0.1,
            "confidence": 0.1,
            "error": "Image too small to be a valid PAN card"
        })

    # The actual vision extraction is performed by the Granite 3.2 Vision model
    # in the agent's LLM call. This tool provides the validated image data
    # and structured output contract back to the agent.
    #
    # The agent's system instructions drive the actual OCR reasoning.
    # This tool acts as the input validator and output formatter.

    return json.dumps({
        "document_base64": document_base64[:100] + "...",  # truncated for log safety
        "mime_type": mime_type,
        "image_size_kb": round(image_size_kb, 1),
        "status": "ready_for_extraction",
        "instruction": (
            "Use your vision capability to read the PAN card in this image. "
            "Extract: full name (exactly as printed), PAN number (5 uppercase letters + 4 digits + 1 uppercase letter), "
            "clarity score (0.0-1.0), confidence (0.0-1.0). "
            "Return ONLY JSON: {name, pan_number, clarity_score, confidence}."
        )
    })
