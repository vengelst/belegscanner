"""
Self-hosted OCR-Service fuer BelegBox.

Nimmt Bilder entgegen, fuehrt PaddleOCR aus und waehlt bei schwierigen Belegen
automatisch das beste Ergebnis aus mehreren Vorverarbeitungsvarianten.
"""

import io
import logging
import os
import sys
from typing import Any

import cv2
import numpy as np
from fastapi import FastAPI, File, Query, UploadFile
from fastapi.responses import JSONResponse
from PIL import Image

logging.basicConfig(level=logging.INFO, stream=sys.stdout)
logger = logging.getLogger("ocr-service")

# Erlaubte Sprachcodes - muessen mit src/lib/env.ts SUPPORTED_OCR_LANGUAGES uebereinstimmen.
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

# OCR-Tuning fuer Uploads:
# - zu grosse Bilder kosten viel CPU und bringen kaum Mehrwert
# - sehr kleine Bilder werden fuer bessere Lesbarkeit skaliert
OCR_MAX_SIDE = 2200
OCR_MIN_SIDE = 1200

# Fast path: wenn das Basisergebnis bereits gut ist, sparen wir weitere OCR-Paesse.
FAST_ACCEPT_MIN_CONFIDENCE = 0.78
FAST_ACCEPT_MIN_LINES = 5
FAST_ACCEPT_MIN_CHARS = 60

ocr_instances: dict[str, Any] = {}


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


app = FastAPI(title="BelegBox OCR Service", version="1.1.0")


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
    effective_lang = lang if lang else DEFAULT_LANG
    contents = await file.read()
    if not contents:
        return JSONResponse(status_code=400, content={"error": "No image file provided"})

    try:
        image_bgr = load_image_bgr(contents)
        engine = get_ocr(effective_lang)
        best = run_ocr_with_quality_selection(engine, image_bgr)
    except ValueError as validation_error:
        return JSONResponse(status_code=422, content={"error": str(validation_error)})
    except Exception as exc:
        logger.exception("OCR processing failed")
        return JSONResponse(
            status_code=500,
            content={"error": f"OCR processing failed: {exc}"},
        )

    logger.info(
        "OCR completed: lines=%d confidence=%.2f score=%.3f variant=%s lang=%s",
        len(best["lines"]),
        best["confidence"],
        best["score"],
        best["variant"],
        effective_lang,
    )

    return {
        "text": best["text"],
        "confidence": round(best["confidence"], 4),
        "lines": best["lines"],
    }


def load_image_bgr(contents: bytes) -> np.ndarray:
    """Validiert Upload-Bild und konvertiert nach OpenCV-BGR."""
    try:
        img = Image.open(io.BytesIO(contents))
        img.verify()
        img = Image.open(io.BytesIO(contents))
    except Exception as exc:
        raise ValueError("Cannot process image: corrupt or unsupported format") from exc

    if img.mode != "RGB":
        img = img.convert("RGB")

    rgb_array = np.array(img)
    return cv2.cvtColor(rgb_array, cv2.COLOR_RGB2BGR)


def run_ocr_with_quality_selection(engine: Any, image_bgr: np.ndarray) -> dict[str, Any]:
    """Fuehrt OCR aus und waehlt bei Bedarf das beste Preprocessing-Ergebnis."""
    base_bgr = resize_for_ocr(image_bgr)
    candidates: list[dict[str, Any]] = []

    base_candidate = run_variant_ocr(engine, "base", cv2.cvtColor(base_bgr, cv2.COLOR_BGR2RGB))
    candidates.append(base_candidate)

    # Fast path fuer bereits gute Ergebnisse
    if (
        base_candidate["confidence"] >= FAST_ACCEPT_MIN_CONFIDENCE
        and base_candidate["line_count"] >= FAST_ACCEPT_MIN_LINES
        and base_candidate["text_chars"] >= FAST_ACCEPT_MIN_CHARS
    ):
        return base_candidate

    deskewed = deskew_image(base_bgr)
    gray = cv2.cvtColor(deskewed, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(gray)
    denoised = cv2.fastNlMeansDenoising(clahe, None, 12, 7, 21)
    adaptive = cv2.adaptiveThreshold(
        denoised,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        31,
        14,
    )
    sharpen_kernel = np.array([[0, -1, 0], [-1, 5.5, -1], [0, -1, 0]], dtype=np.float32)
    sharpened_bgr = cv2.filter2D(cv2.cvtColor(denoised, cv2.COLOR_GRAY2BGR), -1, sharpen_kernel)

    candidates.append(run_variant_ocr(engine, "deskew_clahe", cv2.cvtColor(denoised, cv2.COLOR_GRAY2RGB)))
    candidates.append(run_variant_ocr(engine, "deskew_adaptive", cv2.cvtColor(adaptive, cv2.COLOR_GRAY2RGB)))
    candidates.append(run_variant_ocr(engine, "deskew_sharpened", cv2.cvtColor(sharpened_bgr, cv2.COLOR_BGR2RGB)))

    best = max(candidates, key=lambda item: item["score"])
    return best


def run_variant_ocr(engine: Any, variant_name: str, rgb_image: np.ndarray) -> dict[str, Any]:
    """Fuehrt OCR fuer eine konkrete Bildvariante aus und bewertet das Resultat."""
    result = engine.ocr(rgb_image, cls=True)
    lines = normalize_ocr_lines(result)
    text = "\n".join(line["text"] for line in lines)
    confidence = (
        sum(float(line["confidence"]) for line in lines) / len(lines)
        if lines
        else 0.0
    )
    metrics = score_text_quality(text, len(lines), confidence)

    return {
        "variant": variant_name,
        "text": text,
        "confidence": confidence,
        "lines": lines,
        "line_count": len(lines),
        "text_chars": metrics["text_chars"],
        "score": metrics["score"],
    }


def normalize_ocr_lines(result: Any) -> list[dict[str, Any]]:
    """Normalisiert PaddleOCR-Ausgabe in ein robustes API-Format."""
    lines: list[dict[str, Any]] = []
    page_result = result[0] if result else []
    if page_result is None:
        page_result = []

    for detection in page_result:
        try:
            bbox = detection[0]
            text = str(detection[1][0]).strip()
            conf = float(detection[1][1])
        except Exception:
            continue

        if not text:
            continue
        lines.append({"text": text, "confidence": conf, "bbox": bbox})

    return lines


def score_text_quality(text: str, line_count: int, avg_confidence: float) -> dict[str, float]:
    """
    Bewertet OCR-Qualitaet als gemischten Score.

    Nicht nur Confidence zaehlt: auch nutzbare Textmenge und Zeilenstruktur
    entscheiden ueber Parsebarkeit fuer Belege.
    """
    text_chars = len(text)
    alnum_chars = sum(ch.isalnum() for ch in text)

    confidence_score = clamp(avg_confidence, 0.0, 1.0)
    length_score = clamp(text_chars / 450.0, 0.0, 1.0)
    density_score = clamp(alnum_chars / 260.0, 0.0, 1.0)
    line_score = clamp(line_count / 16.0, 0.0, 1.0)

    total = (
        confidence_score * 0.58
        + density_score * 0.22
        + line_score * 0.12
        + length_score * 0.08
    )

    if text_chars < 24:
        total -= 0.15
    if line_count < 2:
        total -= 0.10

    return {"score": clamp(total, 0.0, 1.0), "text_chars": float(text_chars)}


def resize_for_ocr(image_bgr: np.ndarray) -> np.ndarray:
    """Skaliert Bilder auf sinnvolle OCR-Groesse."""
    height, width = image_bgr.shape[:2]
    max_side = max(height, width)
    min_side = min(height, width)

    scale = 1.0
    if max_side > OCR_MAX_SIDE:
        scale = OCR_MAX_SIDE / max_side
    elif min_side < OCR_MIN_SIDE:
        scale = OCR_MIN_SIDE / min_side

    if abs(scale - 1.0) < 0.01:
        return image_bgr

    new_width = max(1, int(round(width * scale)))
    new_height = max(1, int(round(height * scale)))
    return cv2.resize(image_bgr, (new_width, new_height), interpolation=cv2.INTER_CUBIC)


def deskew_image(image_bgr: np.ndarray) -> np.ndarray:
    """Korrigiert moderate Schraeglage fuer bessere Texterkennung."""
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    bw = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)[1]
    coords = np.column_stack(np.where(bw > 0))

    if coords.shape[0] < 200:
        return image_bgr

    angle = cv2.minAreaRect(coords)[-1]
    if angle < -45:
        angle = -(90 + angle)
    else:
        angle = -angle

    # Nur leichte Schraeglagen korrigieren, um keine Artefakte zu erzeugen.
    if abs(angle) < 0.3 or abs(angle) > 17:
        return image_bgr

    height, width = image_bgr.shape[:2]
    center = (width // 2, height // 2)
    matrix = cv2.getRotationMatrix2D(center, angle, 1.0)
    return cv2.warpAffine(
        image_bgr,
        matrix,
        (width, height),
        flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_REPLICATE,
    )


def clamp(value: float, min_value: float, max_value: float) -> float:
    return max(min_value, min(max_value, value))
