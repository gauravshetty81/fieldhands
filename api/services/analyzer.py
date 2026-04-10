"""
Local OCR + Kannada→English translation.
No data leaves the machine. Models are downloaded once and cached locally.
"""
import re
import unicodedata

import psutil


# ── Memory safety ─────────────────────────────────────────────────────────────

MIN_FREE_RAM_GB = 2.0


def _memory_check():
    free_gb = psutil.virtual_memory().available / (1024 ** 3)
    if free_gb < MIN_FREE_RAM_GB:
        raise MemoryError(
            f"Not enough free RAM ({free_gb:.1f} GB available, {MIN_FREE_RAM_GB} GB required). "
            "Close other applications and try again."
        )


# ── Text extraction ────────────────────────────────────────────────────────────

def _cid_ratio(text: str) -> float:
    """Fraction of characters that are (cid:XXXX) — indicates non-Unicode font."""
    import re
    cid_chars = sum(len(m.group()) for m in re.finditer(r'\(cid:\d+\)', text))
    return cid_chars / max(len(text), 1)


def _extract_from_pdf(file_path: str) -> tuple[str, str]:
    """Returns (text, method) where method is 'pdfplumber' or 'easyocr'."""
    import pdfplumber
    with pdfplumber.open(file_path) as pdf:
        pages = [p.extract_text(layout=True) or "" for p in pdf.pages]
    text = "\n".join(pages).strip()

    # Fall back to OCR if: too short, or non-Unicode font (cid: garbage > 5%)
    if len(text) >= 50 and _cid_ratio(text) < 0.05:
        return text, "pdfplumber"

    # Non-Unicode font or scanned PDF — render pages as images and OCR
    return _ocr_pdf_images(file_path), "easyocr"


def _sort_ocr_results(results: list) -> str:
    """
    Sort EasyOCR bounding boxes top-to-bottom, left-to-right.
    Groups nearby lines into paragraphs using a y-tolerance.
    results: list of (bbox, text, confidence) from detail=1
    """
    if not results:
        return ""

    # Each bbox is [[x1,y1],[x2,y1],[x2,y2],[x1,y2]]
    # Sort by top-left y, then x
    results = sorted(results, key=lambda r: (r[0][0][1], r[0][0][0]))

    # Estimate average line height to group lines into paragraphs
    heights = [abs(r[0][2][1] - r[0][0][1]) for r in results]
    avg_h = sum(heights) / len(heights) if heights else 20
    gap_threshold = avg_h * 1.5

    lines = []
    current_line: list[str] = []
    prev_y = results[0][0][0][1]

    for bbox, text, _conf in results:
        top_y = bbox[0][1]
        if top_y - prev_y > gap_threshold and current_line:
            lines.append(" ".join(current_line))
            current_line = []
        current_line.append(text.strip())
        prev_y = top_y

    if current_line:
        lines.append(" ".join(current_line))

    return "\n".join(lines)


def _ocr_pdf_images(file_path: str) -> str:
    from pdf2image import convert_from_path
    import torch
    import easyocr

    import numpy as np

    torch.set_num_threads(4)
    images = convert_from_path(file_path, dpi=200)
    reader = easyocr.Reader(["kn", "en"], gpu=False)
    all_text = []
    for img in images:
        results = reader.readtext(np.array(img), detail=1, paragraph=False)
        all_text.append(_sort_ocr_results(results))
    del reader
    return "\n\n--- Page break ---\n\n".join(all_text)


def _preprocess_image(file_path: str) -> "np.ndarray":
    """
    Preprocess a phone-photographed document image:
    1. Detect and perspective-correct the document (crop out background)
    2. Convert to grayscale
    3. CLAHE contrast enhancement
    4. Denoise
    5. Adaptive threshold (makes ink pop on aged/yellowed paper)
    Returns a numpy array ready for EasyOCR.
    """
    import cv2
    import numpy as np

    img = cv2.imread(file_path)
    if img is None:
        # Fallback: load via PIL for non-standard formats
        from PIL import Image
        img = cv2.cvtColor(np.array(Image.open(file_path).convert("RGB")), cv2.COLOR_RGB2BGR)

    h, w = img.shape[:2]

    # ── Step 1: Try to detect document boundary and perspective-correct ──────────
    gray_pre = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blurred  = cv2.GaussianBlur(gray_pre, (5, 5), 0)
    edged    = cv2.Canny(blurred, 30, 100)
    edged    = cv2.dilate(edged, cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3)), iterations=2)

    contours, _ = cv2.findContours(edged, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    doc_img = img  # default: use full image if detection fails

    if contours:
        # Find the largest contour that looks like a quadrilateral
        contours = sorted(contours, key=cv2.contourArea, reverse=True)
        for cnt in contours[:5]:
            peri   = cv2.arcLength(cnt, True)
            approx = cv2.approxPolyDP(cnt, 0.02 * peri, True)
            area   = cv2.contourArea(cnt)
            if len(approx) == 4 and area > (h * w * 0.2):
                # Order points: top-left, top-right, bottom-right, bottom-left
                pts = approx.reshape(4, 2).astype("float32")
                rect = _order_points(pts)
                tl, tr, br, bl = rect
                wA = np.linalg.norm(br - bl)
                wB = np.linalg.norm(tr - tl)
                hA = np.linalg.norm(tr - br)
                hB = np.linalg.norm(tl - bl)
                maxW = int(max(wA, wB))
                maxH = int(max(hA, hB))
                if maxW > 100 and maxH > 100:
                    dst = np.array([[0,0],[maxW-1,0],[maxW-1,maxH-1],[0,maxH-1]], dtype="float32")
                    M = cv2.getPerspectiveTransform(rect, dst)
                    doc_img = cv2.warpPerspective(img, M, (maxW, maxH))
                    break

    # ── Step 2: Grayscale ─────────────────────────────────────────────────────────
    gray = cv2.cvtColor(doc_img, cv2.COLOR_BGR2GRAY)

    # ── Step 3: CLAHE contrast enhancement ───────────────────────────────────────
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    gray  = clahe.apply(gray)

    # ── Step 4: Denoise ───────────────────────────────────────────────────────────
    gray = cv2.fastNlMeansDenoising(gray, h=10, templateWindowSize=7, searchWindowSize=21)

    # ── Step 5: Adaptive threshold (handles uneven lighting from phone photos) ────
    binary = cv2.adaptiveThreshold(
        gray, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        blockSize=31,
        C=15,
    )

    return binary


def _order_points(pts: "np.ndarray") -> "np.ndarray":
    """Order 4 points as top-left, top-right, bottom-right, bottom-left."""
    import numpy as np
    rect = np.zeros((4, 2), dtype="float32")
    s    = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]   # top-left: smallest sum
    rect[2] = pts[np.argmax(s)]   # bottom-right: largest sum
    diff    = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)] # top-right: smallest diff
    rect[3] = pts[np.argmax(diff)] # bottom-left: largest diff
    return rect


def _ocr_image(file_path: str) -> tuple[str, str]:
    import torch
    import easyocr
    import numpy as np

    preprocessed = _preprocess_image(file_path)

    torch.set_num_threads(4)
    reader  = easyocr.Reader(["kn", "en"], gpu=False)
    results = reader.readtext(preprocessed, detail=1, paragraph=False)
    del reader
    return _sort_ocr_results(results), "easyocr"


# ── Kannada detection & translation ───────────────────────────────────────────

_KANNADA_RE = re.compile(r"[\u0C80-\u0CFF]+(?:\s+[\u0C80-\u0CFF]+)*")


def _has_kannada(text: str) -> bool:
    return bool(_KANNADA_RE.search(text))


def _run_translation(text: str, extracted_fields: dict) -> tuple[str, dict]:
    """
    Load the NLLB model once, translate the full OCR text line-by-line,
    and translate any field values that are still in Kannada.
    Returns (translated_text, translated_fields).
    """
    needs_translation = _has_kannada(text) or (
        extracted_fields and _has_kannada(" ".join(extracted_fields.values()))
    )
    if not needs_translation:
        return text, extracted_fields

    from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
    import torch

    torch.set_num_threads(4)
    model_name = "facebook/nllb-200-distilled-600M"
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = AutoModelForSeq2SeqLM.from_pretrained(model_name)
    model.eval()
    target_lang_id = tokenizer.convert_tokens_to_ids("eng_Latn")

    def _translate(s: str, max_len: int = 512) -> str:
        inputs = tokenizer(s, return_tensors="pt", truncation=True,
                           max_length=max_len, src_lang="kan_Knda")
        with torch.no_grad():
            out = model.generate(**inputs, forced_bos_token_id=target_lang_id,
                                 max_new_tokens=max_len)
        return tokenizer.decode(out[0], skip_special_tokens=True)

    # Translate full text line by line
    output_lines = []
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped:
            output_lines.append("")
        elif _has_kannada(stripped):
            output_lines.append(_translate(stripped))
        else:
            output_lines.append(stripped)
    translated_text = "\n".join(output_lines)

    # Translate field values still in Kannada
    translated_fields = dict(extracted_fields)
    for key, val in translated_fields.items():
        if _has_kannada(val):
            translated_fields[key] = _translate(val, max_len=128)

    del model, tokenizer
    return translated_text, translated_fields


# ── Public entry point ─────────────────────────────────────────────────────────

def analyze_document(file_path: str, mime_type: str, document_type: str = "") -> dict:
    """
    Extract text, run template field extraction, and translate remaining Kannada.
    Returns: { ocr_text, translated_text, extracted_fields, method_used }
    Raises MemoryError if RAM is too low.
    """
    _memory_check()

    if mime_type == "application/pdf":
        ocr_text, method = _extract_from_pdf(file_path)
    else:
        ocr_text, method = _ocr_image(file_path)

    # Template extraction — fast, no ML needed
    from api.services.templates import extract_fields
    extracted_fields = extract_fields(ocr_text, document_type)

    # Single model load: translate full text + any Kannada field values
    translated_text, extracted_fields = _run_translation(ocr_text, extracted_fields)

    return {
        "ocr_text": ocr_text,
        "translated_text": translated_text,
        "extracted_fields": extracted_fields,
        "method_used": method,
    }
