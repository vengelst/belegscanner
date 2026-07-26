"""Reine, abhaengigkeitsfreie Groessen-/Sicherheitsgrenzen fuer den OCR-Service.

Bewusst ohne cv2/numpy/PIL-Import, damit die Grenzwertlogik isoliert und schnell
(ohne PaddleOCR-Stack) getestet werden kann.
"""

import os

# Harte Obergrenze fuer die Gesamtpixelzahl (Breite * Hoehe) eines eingehenden
# Bildes. 40 Megapixel deckt hochaufgeloeste Handyfotos komfortabel ab, verhindert
# aber, dass ein manipuliertes Bild mit z.B. 60.000 x 60.000 Pixeln (3,6 Mrd. Pixel)
# den Prozess in den OOM-Kill treibt.
DEFAULT_MAX_IMAGE_PIXELS = 40_000_000

# Zusaetzliche Kantenlaengen-Obergrenze: extrem lange, schmale Bilder haben
# vielleicht wenig Gesamtpixel, koennen cv2 aber trotzdem destabilisieren.
DEFAULT_MAX_IMAGE_DIMENSION = 20_000


def _env_int(name: str, fallback: int) -> int:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return fallback
    try:
        value = int(raw)
    except ValueError:
        return fallback
    return value if value > 0 else fallback


MAX_IMAGE_PIXELS = _env_int("OCR_MAX_IMAGE_PIXELS", DEFAULT_MAX_IMAGE_PIXELS)
MAX_IMAGE_DIMENSION = _env_int("OCR_MAX_IMAGE_DIMENSION", DEFAULT_MAX_IMAGE_DIMENSION)


class ImageTooLargeError(ValueError):
    """Bild ueberschreitet die erlaubte Pixel-/Kantengrenze (fuehrt zu HTTP 422)."""


def assert_image_within_limits(
    width: int,
    height: int,
    max_pixels: int = MAX_IMAGE_PIXELS,
    max_dimension: int = MAX_IMAGE_DIMENSION,
) -> None:
    """Wirft ``ImageTooLargeError`` bei Verstoss, ``ValueError`` bei Unsinnwerten.

    Muss VOR jeder np.array/cv2-Verarbeitung aufgerufen werden.
    """
    if not isinstance(width, int) or not isinstance(height, int):
        raise ValueError("Cannot process image: invalid dimensions")

    if width <= 0 or height <= 0:
        raise ValueError("Cannot process image: invalid dimensions")

    if width > max_dimension or height > max_dimension:
        raise ImageTooLargeError(
            "Image rejected: dimension "
            f"{width}x{height} exceeds the maximum allowed edge length of "
            f"{max_dimension}px."
        )

    total_pixels = width * height
    if total_pixels > max_pixels:
        raise ImageTooLargeError(
            "Image rejected: "
            f"{total_pixels} pixels ({width}x{height}) exceeds the maximum allowed "
            f"size of {max_pixels} pixels."
        )
