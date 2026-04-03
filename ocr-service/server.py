"""
Minimaler OCR-Service fuer BelegBox.
Nimmt Bilder entgegen, fuehrt PaddleOCR aus, gibt Text + Confidence zurueck.

Sprachstrategie:
  PaddleOCR-Modelle sind zeichensatzbasiert, nicht einzelsprachlich.
  "german" verwendet das lateinische Modell und erkennt damit auch englische,
  franzoesische und andere Texte mit lateinischen Buchstaben zuverlaessig.
  Ein separates "deu+eng" wie bei Tesseract ist nicht noetig und nicht moeglich.
  Die Env-Variable OCR_LANGUAGE akzeptiert PaddleOCR-Sprachcodes (z.B. "german", "en").
"""

import io
import logging
import os
import sys

from fastapi import FastAPI, File, Query, UploadFile
from fastapi.responses import JSONResponse
from PIL import Image

logging.basicConfig(level=logging.INFO, stream=sys.stdout)
logger = logging.getLogger("ocr-service")

# ---------------------------------------------------------------------------
# PaddleOCR initialisieren (einmalig beim Start)
# ---------------------------------------------------------------------------

# Erlaubte Sprachcodes — muessen mit src/lib/env.ts SUPPORTED_OCR_LANGUAGES uebereinstimmen.
# "german" deckt alle lateinischen Schriften ab (DE, EN, FR, HR, etc.).
ALLOWED_LANGUAGES = {"german", "en", "latin", "french", "spanish", "italian", "portuguese"}

DEFAULT_LANG = os.environ.get("OCR_LANGUAGE", "german")
if DEFAULT_LANG not in ALLOWED_LANGUAGES:
    logger.error(
        "OCR_LANGUAGE='%s' is not supported. Allowed: %s. Falling back to 'german'.",
        DEFAULT_LANG,
        ", ".join(sorted(ALLOWED_LANGUAGES)),
    )
    DEFAULT_LANG = "german"

ocr_instances: dict = {}


def get_ocr(lang: str):
    """Gibt eine gecachte PaddleOCR-Instanz fuer die gewuenschte Sprache zurueck."""
    if lang not in ALLOWED_LANGUAGES:
        logger.warning("Requested lang='%s' not allowed, using default '%s'.", lang, DEFAULT_LANG)
        lang = DEFAULT_LANG
    if lang not in ocr_instances:
        from paddleocr import PaddleOCR

        logger.info("Loading PaddleOCR model for lang=%s ...", lang)
        ocr_instances[lang] = PaddleOCR(
            use_angle_cls=True,
            lang=lang,
            use_gpu=False,
            show_log=False,
        )
        logger.info("PaddleOCR model for lang=%s loaded.", lang)
    return ocr_instances[lang]


# ---------------------------------------------------------------------------
# FastAPI App
# ---------------------------------------------------------------------------

app = FastAPI(title="BelegBox OCR Service", version="1.0.0")


@app.on_event("startup")
async def startup():
    """Modell beim Start laden, damit der erste Request schnell ist."""
    get_ocr(DEFAULT_LANG)
    logger.info("OCR service ready (default lang=%s).", DEFAULT_LANG)


@app.get("/health")
async def health():
    return {"status": "ok", "model_loaded": len(ocr_instances) > 0}


@app.post("/ocr")
async def ocr_endpoint(
    file: UploadFile = File(...),
    lang: str = Query(default=None, description="PaddleOCR-Sprachcode (z.B. german, en)"),
):
    # Sprache: Query-Parameter ueberschreibt Default, Fallback auf Server-Default
    effective_lang = lang if lang else DEFAULT_LANG

    # Bild validieren
    contents = await file.read()
    if not contents:
        return JSONResponse(status_code=400, content={"error": "No image file provided"})

    try:
        img = Image.open(io.BytesIO(contents))
        img.verify()
        # verify() schliesst den Stream, also nochmal oeffnen fuer OCR
        img = Image.open(io.BytesIO(contents))
    except Exception:
        return JSONResponse(
            status_code=422,
            content={"error": "Cannot process image: corrupt or unsupported format"},
        )

    # In RGB konvertieren (PaddleOCR erwartet das)
    if img.mode != "RGB":
        img = img.convert("RGB")

    # OCR ausfuehren
    try:
        import numpy as np

        img_array = np.array(img)
        engine = get_ocr(effective_lang)
        result = engine.ocr(img_array, cls=True)
    except Exception as exc:
        logger.exception("OCR processing failed")
        return JSONResponse(
            status_code=500,
            content={"error": f"OCR processing failed: {exc}"},
        )

    # Ergebnis in einheitliches Format transformieren
    lines = []
    all_confidences = []

    # PaddleOCR gibt eine Liste pro Seite zurueck; wir haben immer eine Seite
    page_result = result[0] if result else []
    if page_result is None:
        page_result = []

    for detection in page_result:
        bbox = detection[0]  # [[x1,y1],[x2,y2],[x3,y3],[x4,y4]]
        text = detection[1][0]
        conf = float(detection[1][1])
        lines.append({"text": text, "confidence": conf, "bbox": bbox})
        all_confidences.append(conf)

    full_text = "\n".join(line["text"] for line in lines)
    avg_confidence = (
        sum(all_confidences) / len(all_confidences) if all_confidences else 0.0
    )

    logger.info(
        "OCR completed: %d lines, confidence=%.2f, lang=%s",
        len(lines),
        avg_confidence,
        effective_lang,
    )

    return {
        "text": full_text,
        "confidence": round(avg_confidence, 4),
        "lines": lines,
    }
