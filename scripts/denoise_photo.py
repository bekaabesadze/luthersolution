#!/usr/bin/env python3
"""
Denoise bekapfp1.jpg using OpenCV and overwrite with a cleaner version.
Run from project root: python scripts/denoise_photo.py
"""
import sys
from pathlib import Path

# Project root is parent of scripts/
ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "frontend" / "public" / "bekapfp1.jpg"
DEST = SRC  # overwrite in place; or set to ROOT / "frontend" / "public" / "bekapfp1_denoised.jpg"

def main():
    try:
        import cv2
    except ImportError:
        print("Install OpenCV first: pip install opencv-python-headless", file=sys.stderr)
        sys.exit(1)

    if not SRC.exists():
        print(f"Image not found: {SRC}", file=sys.stderr)
        sys.exit(1)

    img = cv2.imread(str(SRC))
    if img is None:
        print("Failed to load image.", file=sys.stderr)
        sys.exit(1)

    # Reduce noise while keeping detail. Moderate strength to avoid over-smoothing.
    denoised = cv2.fastNlMeansDenoisingColored(
        img,
        None,
        h=6,           # luminance strength (higher = more smoothing)
        hColor=6,       # color component strength
        templateWindowSize=7,
        searchWindowSize=21,
    )

    cv2.imwrite(str(DEST), denoised, [cv2.IMWRITE_JPEG_QUALITY, 92])
    print(f"Saved denoised image to {DEST}")

if __name__ == "__main__":
    main()
