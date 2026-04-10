"""
Template-based field extraction for Karnataka government land documents.
Matches known Kannada field labels in OCR text to extract structured data.
No translation model needed — labels are hardcoded, values are mostly English/numbers.
"""
import re
from typing import Optional

# ── Value translations for common Kannada values ──────────────────────────────

_VALUE_MAP = {
    "ಖಾಸಗಿ":         "Private",
    "ಸರ್ಕಾರಿ":        "Government",
    "ಅರಣ್ಯ":          "Forest",
    "ನಿವೇಶನ":         "Site / Plot",
    "ಕೃಷಿ":           "Agricultural",
    "ವಾಣಿಜ್ಯ":        "Commercial",
    "ವಸತಿ":           "Residential",
    "ಹಾ":             "Yes",
    "ಇಲ್ಲ":           "No",
    "ಗಂಡು":           "Male",
    "ಹೆಣ್ಣು":         "Female",
    "ಮಳೆಯಾಶ್ರಿತ":    "Rain-fed",
    "ನೀರಾವರಿ":        "Irrigated",
    "ಒಣಭೂಮಿ":         "Dry land",
    "ತರಿ":            "Wet land",
}

def _translate_value(val: str) -> str:
    """Translate a known Kannada value to English, or return as-is."""
    v = val.strip()
    return _VALUE_MAP.get(v, v)


# ── Generic label search ───────────────────────────────────────────────────────

def _find_value(text: str, *labels: str, multiline: bool = False) -> Optional[str]:
    """
    Search for any of the given Kannada labels in text.
    Returns the value that follows the label on the same line (or next line).
    """
    for label in labels:
        # Escape label for regex, allow optional punctuation/spaces after it
        pattern = re.escape(label) + r'[\s:]*([^\n]{1,120})'
        m = re.search(pattern, text)
        if m:
            val = m.group(1).strip().rstrip('|').strip()
            if val:
                return _translate_value(val)
        # Try: label on one line, value on the next
        pattern2 = re.escape(label) + r'\s*\n\s*([^\n]{1,120})'
        m2 = re.search(pattern2, text)
        if m2:
            val = m2.group(1).strip().rstrip('|').strip()
            if val:
                return _translate_value(val)
    return None


def _find_all(text: str, label: str) -> list[str]:
    """Find all values after a repeating label (e.g. multiple owners)."""
    pattern = re.escape(label) + r'[\s:]*([^\n]{1,120})'
    return [_translate_value(m.group(1).strip()) for m in re.finditer(pattern, text) if m.group(1).strip()]


# ── Document type templates ────────────────────────────────────────────────────

def extract_katha(text: str) -> dict:
    """BBMP / CMC Khata Extract (Form A, Rule 11).
    Uses targeted regex patterns matched to the actual BBMP Khata document structure.
    """
    fields = {}

    # ── Document number (standalone digits after ದಾಖಲೆ ಸಂಖ) ──────────────────
    m = re.search(r'ದಾಖಲೆ\s+ಸಂಖ[\w]*\s+(\d{5,})', text)
    if m: fields["Document Number"] = m.group(1)

    # ── District (between ಜಲೆ/ಜಿಲ್ಲೆ and ನಗರ:) ────────────────────────────────
    m = re.search(r'(?:ಜಿಲ್ಲೆ|ಜಲೆ)\s+([\u0C80-\u0CFF\s]+?)\s+ನಗರ\s*:', text)
    if m: fields["District"] = m.group(1).strip()

    # ── City / ULB (after ನಗರ: , stop before next Kannada word) ─────────────────
    m = re.search(r'ನಗರ\s*:\s*([A-Za-z0-9.\s]+?)(?=\s+[\u0C80-\u0CFF])', text)
    if m: fields["City / ULB"] = m.group(1).strip()

    # ── Property type (after ತರಹೆ:) ──────────────────────────────────────────────
    m = re.search(r'ತರಹೆ\s*:\s*([\u0C80-\u0CFF]+)', text)
    if m:
        val = m.group(1).strip()
        fields["Property Type"] = _VALUE_MAP.get(val, val)

    # ── Property number / Site number ─────────────────────────────────────────────
    m = re.search(r'(\d{3,4}/\d{3,4}(?:/\d{3,4})*(?:/\d+[A-Z]*)?)', text)
    if m: fields["Property / Site Number"] = m.group(1)

    # ── Property PID (10-digit number) ────────────────────────────────────────────
    m = re.search(r'\b(\d{10})\b', text)
    if m: fields["Property PID"] = m.group(1)

    # ── Ward number ───────────────────────────────────────────────────────────────
    m = re.search(r'\b(\d{3})\s+NA\b', text)
    if m: fields["Ward Number"] = m.group(1)

    # ── Plot area (decimal sq.m + integer sq.ft pattern: "219.24 2360 NA") ───────
    m = re.search(r'(\d{2,4}\.\d{1,2})\s+(\d{3,5})\s+NA\b', text)
    if m: fields["Plot Area"] = f"{m.group(1)} sq.m  /  {m.group(2)} sq.ft"

    # ── Plot dimensions (59 X 40 / 17.98 X 12.19) ────────────────────────────────
    m = re.search(r'(\d{1,3}\s*[Xx]\s*\d{1,3}\s*/\s*[\d.]+\s*[Xx]\s*[\d.]+)', text)
    if m: fields["Plot Dimensions (ft / m)"] = m.group(1).strip()

    # ── Property address (line with pincode 560XXX) ───────────────────────────────
    m = re.search(r'([A-Za-z0-9,\s]+56\d{4})', text)
    if m:
        addr = re.sub(r'\s+', ' ', m.group(1)).strip().strip(',')
        fields["Property Address"] = addr

    # ── Boundaries: look for direction-header line then parse the values line ────
    # Pattern: ಉತ್ತರ ಪಶಿಬ(ಯ) ಪೂರ್ವ ದಕ್ಷ(ಣ) on one line, boundary values on next
    m = re.search(r'ಉತ್ತರ\s+ಪಶ[\u0C80-\u0CFF]+\s+ಪೂರ್ವ\s+ದಕ್ಷ[\u0C80-\u0CFF]*\s*\n(.+)', text)
    if m:
        bline = m.group(1).strip()
        # Extract "Site No XXXX" tokens and remaining text (e.g. "Road")
        tokens = re.findall(r'Site\s+No\s+\w+|\bRoad\b|\bNA\b|[\w]+', bline)
        # Merge "Site No XXXX" back into single tokens
        merged = []
        i = 0
        while i < len(tokens):
            if tokens[i] == 'Site' and i + 2 < len(tokens) and tokens[i+1] == 'No':
                merged.append(f"Site No {tokens[i+2]}")
                i += 3
            else:
                merged.append(tokens[i])
                i += 1
        # Order on the header line is: North, West, East, South
        dirs = ["Boundary North", "Boundary West", "Boundary East", "Boundary South"]
        for j, d in enumerate(dirs):
            if j < len(merged) and merged[j] not in ("NA",):
                fields[d] = merged[j]

    # ── Owner name (Kannada: before ಆಧಾರ್ on the owner data line) ─────────────
    m = re.search(r'([\u0C80-\u0CFF]+\s+[\u0C80-\u0CFF]+)\s+ಆಧಾರ್', text)
    if m: fields["Owner Name (Kannada)"] = m.group(1).strip()

    # ── Owner name (English: from Flat No line) ───────────────────────────────────
    m = re.search(r'Flat\s+No\s+\d+\s+\w+\s+([A-Z][A-Z\s]+?)\s+(?:[A-Z]{2}\s+[A-Z]+|Apartment)', text)
    if m: fields["Owner Name"] = m.group(1).strip()

    # ── Aadhaar (masked) ─────────────────────────────────────────────────────────
    m = re.search(r'(X{4,8}\d{4})', text)
    if m: fields["Aadhaar (masked)"] = m.group(1)

    # ── Owner address (English) ───────────────────────────────────────────────────
    m = re.search(r'(Flat\s+No\s+\d+.{10,120}560\d{3})', text, re.DOTALL)
    if m:
        addr = re.sub(r'\s+', ' ', m.group(1)).strip()
        fields["Owner Address"] = addr[:160]

    # ── Issued by (officer name on the RENUKA PRASAD line) ───────────────────────
    m = re.search(r'([A-Z][A-Z\s]{3,30})\s+ಸಹಾಯಕ\s+ಕಂದಾಯ\s+ಅಧಿಕಾರಿ', text)
    if m:
        fields["Issued By"] = m.group(1).strip() + ", Assistant Revenue Officer"
    m2 = re.search(r'ಸಹಾಯಕ\s+ಕಂದಾಯ\s+ಅಧಿಕಾರಿ\s+([\u0C80-\u0CFF\w\s]+?)(?:\n|ಬ)', text)
    if m2 and "Issued By" not in fields:
        fields["Issued By"] = "Assistant Revenue Officer, " + m2.group(1).strip()

    # ── Issue date (DD/MM/YYYY) ───────────────────────────────────────────────────
    m = re.search(r'(\d{2}/\d{2}/\d{4})', text)
    if m: fields["Issue Date"] = m.group(1)

    # ── Challan number (12-digit) ─────────────────────────────────────────────────
    m = re.search(r'\b(\d{12})\b', text)
    if m: fields["Challan Number"] = m.group(1)

    return {k: v for k, v in fields.items() if v}


def extract_rtc(text: str) -> dict:
    """RTC — Record of Rights, Tenancies and Crops (Pahani)."""
    fields = {}

    fields["Survey Number"] = _find_value(text, "ಸರ್ವೆ ನಂಬರ್", "ಸರ್ವೇ ನಂಬರ್", "ಸರ್ವೆ ಸಂಖ್ಯೆ")
    fields["Hissa Number"] = _find_value(text, "ಹಿಸ್ಸಾ ನಂಬರ್", "ಹಿಸ್ಸಾ")
    fields["Village"] = _find_value(text, "ಗ್ರಾಮ", "ಹಳ್ಳಿ")
    fields["Hobli"] = _find_value(text, "ಹೋಬಳಿ")
    fields["Taluk"] = _find_value(text, "ತಾಲ್ಲೂಕು", "ತಾಲೂಕು")
    fields["District"] = _find_value(text, "ಜಿಲ್ಲೆ")
    fields["Owner Name"] = _find_value(text, "ಹೊಲದ ಒಡೆಯರ ಹೆಸರು", "ಮಾಲೀಕರ ಹೆಸರು", "ಒಡೆಯರ ಹೆಸರು")
    fields["Total Area"] = _find_value(text, "ಒಟ್ಟು ವಿಸ್ತೀರ್ಣ", "ಒಟ್ಟು ಜಮೀನು")
    fields["Dry Land Area"] = _find_value(text, "ಒಣ ಜಮೀನು", "ಜಮೀನು ಒಣ")
    fields["Wet Land Area"] = _find_value(text, "ತರಿ ಜಮೀನು")
    fields["Land Revenue"] = _find_value(text, "ಭೂ ಕಂದಾಯ", "ಕಂದಾಯ")
    fields["Irrigation Source"] = _find_value(text, "ನೀರಾವರಿ ಮೂಲ")
    fields["Soil Type"] = _find_value(text, "ಮಣ್ಣಿನ ವಿಧ")
    fields["Crop (Kharif)"] = _find_value(text, "ಖರೀಫ್ ಬೆಳೆ", "ಖರೀಫ್")
    fields["Crop (Rabi)"] = _find_value(text, "ರಬಿ ಬೆಳೆ", "ರಬಿ")
    fields["Liabilities"] = _find_value(text, "ಋಣ", "ಸಾಲ")
    fields["Possession Type"] = _find_value(text, "ಭೋಗ್ಯ", "ಹಕ್ಕು")

    return {k: v for k, v in fields.items() if v}


def extract_ec(text: str) -> dict:
    """Encumbrance Certificate (EC)."""
    fields = {}

    fields["EC Number"] = _find_value(text, "ಇ.ಸಿ. ಸಂಖ್ಯೆ", "EC ಸಂಖ್ಯೆ")
    fields["Property Description"] = _find_value(text, "ಆಸ್ತಿ ವಿವರ", "ಸ್ವತ್ತಿನ ವಿವರ")
    fields["Survey Number"] = _find_value(text, "ಸರ್ವೆ ನಂಬರ್", "ಸರ್ವೇ ನಂಬರ್")
    fields["Village"] = _find_value(text, "ಗ್ರಾಮ")
    fields["Taluk"] = _find_value(text, "ತಾಲ್ಲೂಕು", "ತಾಲೂಕು")
    fields["District"] = _find_value(text, "ಜಿಲ್ಲೆ")
    fields["Period From"] = _find_value(text, "ದಿನಾಂಕದಿಂದ", "ಅವಧಿ ಆರಂಭ")
    fields["Period To"] = _find_value(text, "ದಿನಾಂಕದವರೆಗೆ", "ಅವಧಿ ಅಂತ್ಯ")
    fields["Encumbrances"] = _find_value(text, "ಹೊರೆ", "ಒತ್ತೆ", "ಅಡಮಾನ")
    fields["Issued By"] = _find_value(text, "ಉಪ ನೋಂದಣಾಧಿಕಾರಿ", "ನೋಂದಣಾಧಿಕಾರಿ")
    fields["Issue Date"] = _find_value(text, "ದಿನಾಂಕ")

    return {k: v for k, v in fields.items() if v}


def extract_land_tax(text: str) -> dict:
    """Land Tax Receipt."""
    fields = {}

    fields["Receipt Number"] = _find_value(text, "ರಸೀದಿ ಸಂಖ್ಯೆ", "ರಶೀದಿ ಸಂಖ್ಯೆ")
    fields["Owner Name"] = _find_value(text, "ಹೊಲದ ಒಡೆಯರ ಹೆಸರು", "ಮಾಲೀಕರ ಹೆಸರು", "ಭೂ ಮಾಲೀಕರ")
    fields["Survey Number"] = _find_value(text, "ಸರ್ವೆ ನಂಬರ್", "ಸರ್ವೇ ನಂಬರ್")
    fields["Village"] = _find_value(text, "ಗ್ರಾಮ")
    fields["Taluk"] = _find_value(text, "ತಾಲ್ಲೂಕು", "ತಾಲೂಕು")
    fields["Tax Amount"] = _find_value(text, "ತೆರಿಗೆ ಮೊತ್ತ", "ಕಂದಾಯ ಮೊತ್ತ")
    fields["Payment Date"] = _find_value(text, "ಪಾವತಿ ದಿನಾಂಕ", "ಪಾವತಿಸಿದ ದಿನಾಂಕ")
    fields["Tax Period"] = _find_value(text, "ತೆರಿಗೆ ವರ್ಷ", "ಸಾಲಿಗೆ")
    fields["Issued By"] = _find_value(text, "ಶಿರಸ್ತೇದಾರ", "ತಹಸೀಲ್ದಾರ್")

    return {k: v for k, v in fields.items() if v}


def extract_mutation(text: str) -> dict:
    """Mutation Register entry."""
    fields = {}

    fields["Mutation Number"] = _find_value(text, "ಮ್ಯುಟೇಶನ್ ಸಂಖ್ಯೆ", "ಪಹಣಿ ಸಂಖ್ಯೆ")
    fields["Survey Number"] = _find_value(text, "ಸರ್ವೆ ನಂಬರ್", "ಸರ್ವೇ ನಂಬರ್")
    fields["Village"] = _find_value(text, "ಗ್ರಾಮ")
    fields["Taluk"] = _find_value(text, "ತಾಲ್ಲೂಕು", "ತಾಲೂಕು")
    fields["Previous Owner"] = _find_value(text, "ಹಿಂದಿನ ಮಾಲೀಕರ", "ಹಳೆಯ ಮಾಲೀಕ")
    fields["New Owner"] = _find_value(text, "ಹೊಸ ಮಾಲೀಕರ", "ನೂತನ ಮಾಲೀಕ")
    fields["Reason for Mutation"] = _find_value(text, "ಮ್ಯುಟೇಶನ್ ಕಾರಣ", "ವರ್ಗಾವಣೆ ಕಾರಣ")
    fields["Mutation Date"] = _find_value(text, "ಮ್ಯುಟೇಶನ್ ದಿನಾಂಕ")
    fields["Area"] = _find_value(text, "ವಿಸ್ತೀರ್ಣ")

    return {k: v for k, v in fields.items() if v}


def extract_patta(text: str) -> dict:
    """Patta (land ownership certificate)."""
    fields = {}

    fields["Patta Number"] = _find_value(text, "ಪಟ್ಟಾ ಸಂಖ್ಯೆ")
    fields["Owner Name"] = _find_value(text, "ಮಾಲೀಕರ ಹೆಸರು", "ಭೂ ಮಾಲೀಕರ ಹೆಸರು")
    fields["Survey Number"] = _find_value(text, "ಸರ್ವೆ ನಂಬರ್", "ಸರ್ವೇ ನಂಬರ್")
    fields["Village"] = _find_value(text, "ಗ್ರಾಮ")
    fields["Taluk"] = _find_value(text, "ತಾಲ್ಲೂಕು", "ತಾಲೂಕು")
    fields["District"] = _find_value(text, "ಜಿಲ್ಲೆ")
    fields["Total Area"] = _find_value(text, "ಒಟ್ಟು ವಿಸ್ತೀರ್ಣ")
    fields["Land Type"] = _find_value(text, "ಭೂಮಿ ವಿಧ", "ಜಮೀನಿನ ವಿಧ")
    fields["Issue Date"] = _find_value(text, "ನೀಡಿದ ದಿನಾಂಕ", "ದಿನಾಂಕ")

    return {k: v for k, v in fields.items() if v}


# ── Document type → extractor mapping ────────────────────────────────────────

_EXTRACTORS = {
    "Katha / Khata":                extract_katha,
    "RTC (Record of Rights)":       extract_rtc,
    "Encumbrance Certificate (EC)": extract_ec,
    "Land Tax Receipt":             extract_land_tax,
    "Mutation Register":            extract_mutation,
    "Patta":                        extract_patta,
}


def extract_fields(text: str, document_type: str) -> dict:
    """
    Run the appropriate template extractor for the given document type.
    Returns a dict of { field_label: value } or {} if no template exists.
    """
    extractor = _EXTRACTORS.get(document_type)
    if not extractor:
        return {}
    return extractor(text)
