"""Tests fuer die OCR-Groessengrenzen (P0-1).

Laeuft ohne PaddleOCR/cv2/numpy:
    cd ocr-service && python3 -m unittest test_limits -v
"""

import unittest

from limits import (
    DEFAULT_MAX_IMAGE_DIMENSION,
    DEFAULT_MAX_IMAGE_PIXELS,
    ImageTooLargeError,
    assert_image_within_limits,
)


class AssertImageWithinLimitsTest(unittest.TestCase):
    def test_typical_receipt_photo_is_accepted(self):
        # 12 MP Handyfoto (4032 x 3024) muss unveraendert durchgehen.
        assert_image_within_limits(4032, 3024)

    def test_high_res_48mp_still_within_default(self):
        # A4-Scan bei 600 dpi (~4960 x 7016 = 34,8 MP) bleibt erlaubt.
        assert_image_within_limits(4960, 7016)

    def test_pixel_bomb_is_rejected(self):
        # 60.000 x 60.000 = 3,6 Mrd. Pixel -> muss abgelehnt werden.
        with self.assertRaises(ImageTooLargeError):
            assert_image_within_limits(60_000, 60_000)

    def test_just_over_pixel_limit_is_rejected(self):
        max_pixels = 40_000_000
        # Quadratisch knapp ueber der Grenze.
        side = int(max_pixels**0.5) + 50
        with self.assertRaises(ImageTooLargeError):
            assert_image_within_limits(side, side, max_pixels=max_pixels)

    def test_long_thin_strip_rejected_by_dimension(self):
        # Wenige Gesamtpixel, aber extreme Kantenlaenge -> Dimensionsgrenze greift.
        with self.assertRaises(ImageTooLargeError):
            assert_image_within_limits(50_000, 10, max_dimension=20_000)

    def test_zero_and_negative_dimensions_are_value_errors(self):
        for w, h in [(0, 100), (100, 0), (-1, 100), (100, -5)]:
            with self.assertRaises(ValueError):
                assert_image_within_limits(w, h)

    def test_image_too_large_is_a_value_error_subclass(self):
        # server.py faengt ValueError als 422; ImageTooLargeError muss darunter fallen.
        self.assertTrue(issubclass(ImageTooLargeError, ValueError))

    def test_defaults_are_sane(self):
        self.assertEqual(DEFAULT_MAX_IMAGE_PIXELS, 40_000_000)
        self.assertEqual(DEFAULT_MAX_IMAGE_DIMENSION, 20_000)


if __name__ == "__main__":
    unittest.main()
