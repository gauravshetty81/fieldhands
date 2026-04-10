# Fieldhands — Project Journal

A running log of all discussions, design decisions, and changes made to the project.
Most recent entries at the top.

---

## Session 3 — 2026-04-09 (continued)

### GitHub
- Repo created: https://github.com/gauravshetty81/fieldhands
- Initial commit pushed — 48 files, all source code
- `storage/` excluded from git (uploaded documents are sensitive, stay local only)
- `.env.example` committed with placeholder values only

### Manual Transcription
- Added for handwritten documents that OCR can't read
- New DB column: `manual_transcription` (Text)
- New endpoint: `PATCH /api/documents/{id}/transcription`
- UI: textarea in detail modal with Save button and ✓ confirmation
- **User feedback:** Added "How to type Kannada ↗" link — must use correct Apple support URL, not guessed URLs
  - Correct URL: https://support.apple.com/guide/mac-help/write-in-another-language-on-mac-mchlp1406/26/mac/26

### Image Preprocessing for Phone Photos
- Added `_preprocess_image()` in `analyzer.py` using OpenCV
- Steps: document boundary detection → perspective correction → grayscale → CLAHE contrast → denoise → adaptive threshold
- Helps with: background removal, uneven lighting, slight skew
- **Limitation acknowledged:** Handwritten Kannada OCR is fundamentally poor regardless of preprocessing. EasyOCR trained on printed text only.

### Katha Template Extractor Rewrite
- Rewrote `extract_katha()` with targeted regex patterns based on actual BBMP Khata document structure
- Root cause of previous failures: multiple table cells merged into one OCR line, generic "grab text after label" captured adjacent fields
- New approach: format-specific patterns (decimal+integer for area, 12-digit for challan, boundary section parser, etc.)
- Fields now extracted: Document Number, District, City/ULB, Property Type, Site Number, PID, Ward, Plot Area, Dimensions, Address, Boundaries (N/W/E/S), Owner Name, Aadhaar, Owner Address, Issued By, Issue Date, Challan

### Editable Document Type in Modal
- Added click-to-edit on document type badge in detail modal header
- Dropdown with all document types, Save/Cancel buttons
- Needed because users may upload with wrong type selected, which breaks template extraction

### Translation Improvement
- Changed from splitting on individual Kannada Unicode blocks to line-by-line translation
- Model loaded once for both full text translation AND field value translation (was loading twice before)
- Translation quality still imperfect for government documents — template extraction is the reliable path

---

## Session 3 — 2026-04-09

### Document Analysis: Template-Based Extraction (Planned)
**User input:** "what if i want to read government documents. Can you not understand the main templates which you listed in the dropdown and be able to recognize which document you are translating?"

**Decision:** Build template-aware structured extraction instead of generic translation.
- Each document type (Katha, RTC, EC, etc.) has known Kannada field labels
- Match labels exactly (no translation needed for headers), extract values next to them
- Most values are already in English (names, numbers, dates)
- Only a few values need translation (e.g. ಖಾಸಗಿ = Private)
- Output: structured card with labeled fields + raw OCR as secondary tab
- **Status: Approved, not yet built**

### OCR + Translation Issues Worked Through
1. **"Not enough free RAM"** — lowered threshold from 4 GB to 2 GB (machine has 3.4 GB free at typical load)
2. **Model not found** — `Helsinki-NLP/opus-mt-kn-en` does not exist on HuggingFace. Switched to `facebook/nllb-200-distilled-600M` which explicitly supports Kannada (`kan_Knda`)
3. **Poppler not installed** — `pdf2image` requires poppler binary. Installed via `brew install poppler`
4. **PIL Image type error** — EasyOCR does not accept PIL Image objects. Fixed by converting to numpy array (`np.array(img)`) before passing to EasyOCR
5. **CID garbage in extracted text** — PDFs using non-Unicode Kannada fonts (e.g. Nudi) produce `(cid:XXXX)` sequences when read by pdfplumber. Fixed by detecting CID ratio > 5% and falling back to EasyOCR image path
6. **EasyOCR reading order** — default `paragraph=True` loses layout on complex documents. Fixed by using `detail=1` (bounding boxes), sorting by top-left y then x, grouping lines by y-gap threshold
7. **Translation fragment quality** — translating individual Kannada Unicode blocks in isolation gave nonsense for short column headers. Changed to line-by-line translation (whole line with Kannada translated together for context)
8. **Translation still poor** — root cause identified: NLLB is a general-purpose model that doesn't know government/legal Kannada terminology, and OCR errors in Kannada conjunct characters produce non-words the model hallucinates on. Agreed to move to template-based extraction instead

### OCR Quality Assessment (BBMP Khata sample)
- EasyOCR is reading the document reasonably well — proper Kannada Unicode characters, most text present
- Key information (owner name, address, area, document numbers) is readable in extracted text without translation
- OCR errors appear in Kannada conjunct characters (e.g. "ಸಎತ್ತಿನ" instead of "ಸ್ವತ್ತಿನ")
- Translation is useful for Kannada prose but not for structured government forms
- Structured template extraction will be much more reliable for the known document types

### UI Fixes
- Added **Re-analyze** button to results header (was missing — no way to rerun on a completed analysis)
- "Try again" was only shown on failure, not on completed docs
- Modal now fetches fresh analysis status from server on open (was relying on stale list cache)
- Added 🔍 indicator in document list for analyzed documents

### User Feedback on Layout
- "the layout is gone and the extracted text doesn't make sense" — acknowledged as a known OCR limitation for table-structured documents. Option A (surya/doctr layout analysis) noted on roadmap for future

---

## Session 2 — (previous session, date approximate)

### Document Vault Refinements
**User input:** "I'll try it out and will change a few things after I test it out"
- No specific refinement requests yet — user was testing

### OCR + Kannada Translation Feature (Designed & Built)
**User input:** "if it's an image of a document, how does it read the document? Can it translate from Kannada and give a summary?"
Then: "use the free version. And run everything locally. Don't send any data out. It is sensitive information."

**Design decisions:**
- 100% local — no API calls, no internet after first model download
- EasyOCR chosen over Tesseract (Tesseract binary not found on this machine, EasyOCR is pure Python)
- Two-path extraction: pdfplumber for digital PDFs (fast), EasyOCR for images and scanned PDFs
- RAM safety: refuse if < 2 GB free, CPU cap at 4 threads, one job at a time lock
- Models cached locally after first download: `~/.EasyOCR/` and `~/.cache/huggingface/`
- Analysis runs as FastAPI BackgroundTask (API stays responsive during processing)
- Results persisted to DB — never re-run unless user requests

**New DB columns on Document:**
- `ocr_text` — raw extracted text
- `translated_text` — English translation
- `analysis_status` — pending / processing / done / failed
- `analysis_error` — error message if failed
- `analyzed_at` — timestamp

**Frontend additions:**
- "Analyze Document" button in detail modal (owners only)
- Confirmation dialog with RAM warning and privacy note
- Spinner with 3s polling while processing
- Tabbed results: English Translation / Extracted Text
- Copy button on text panels

---

## Session 1 — (previous session)

### Project Origin
**User:** Inherited 0.8 acre farm near Udupi, Karnataka. ~100 coconut trees, betel nut. Father's land. Wanted a management app to track documents, financials, farm operations, government compliance.

**App name iterations:** Krishi (rejected — too Indian), Tillage → user changed to **Fieldhands**

### Core Architecture Decisions
- **Backend:** FastAPI + SQLAlchemy + PostgreSQL (port 5434 via Docker)
- **Frontend:** React + TypeScript + Vite + Tailwind CSS v4
- **Auth:** JWT (python-jose), 12-hour tokens, role-based (owner, co_owner, caretaker, accountant, viewer)
- **Database:** PostgreSQL via Docker Compose, Alembic migrations

### Modules Built
1. **Auth** — login, JWT, role guards
2. **Dashboard** — land profile, weather widget (OpenMeteo, free, no API key), recent activity, quick stats
3. **Document Vault** — file upload (PDF/image, 50MB max), metadata (type, authority, dates, survey number, tags, cost), expiry tracking, download, delete
4. **Roadmap** — feature/idea tracking, priority groups, status workflow, tags
5. **Settings** — land profile edit (GPS, area, survey number)
6. **Users** — user management (owner only)

### Document Types Supported
Title Deed / Sale Deed, RTC (Record of Rights), Katha / Khata, Land Tax Receipt, Survey Sketch, Encumbrance Certificate (EC), Tippan, Mutation Register, Patta, Power of Attorney, Other

### Land Profile (seeded)
- Location: Udupi area, Karnataka
- GPS: 13.3409°N, 74.7421°E
- Area: 0.8 acres
- Crops: Coconut × 100, Betel Nut

### dev.sh Script
Unified startup/shutdown for all projects:
```
./dev.sh startup fieldhands   # starts DB, API (port 8001), frontend (port 5173)
./dev.sh shutdown fieldhands
./dev.sh status
```

---

## Roadmap Items (tracked in app)

| Title | Status | Notes |
|---|---|---|
| Document Vault | done | Built, OCR added |
| Structured OCR (template-based) | idea | Approved, not built — template matching per document type |
| Structured OCR (layout-aware) | idea | Option A — surya/doctr for table layout analysis, more complex |
| Government tasks tracker | idea | Track pending govt tasks, deadlines |
| Farm automation planning | idea | Irrigation schedules, crop calendars |
| Accounting & Finance | idea | Expense tracking, income from farm |

---

## Key Technical Notes

### Non-Unicode Kannada PDFs
Government PDFs often use legacy Nudi fonts. pdfplumber extracts `(cid:XXXX)` sequences instead of Unicode.
Fix: detect CID ratio > 5% in extracted text → fall back to EasyOCR on rendered page images.

### EasyOCR on PDFs
Requires poppler: `brew install poppler`. pdf2image returns PIL Images — must convert to `np.array(img)` before passing to EasyOCR.

### Translation Model
`facebook/nllb-200-distilled-600M` — supports Kannada (`kan_Knda`), ~1.3 GB, cached at `~/.cache/huggingface/`.
`Helsinki-NLP/opus-mt-kn-en` does NOT exist — don't use it.

### Ports
| Service | Port |
|---|---|
| Fieldhands API | 8001 |
| Fieldhands Frontend | 5173 |
| PostgreSQL | 5434 |
| Budget API | 8000 (stopped) |

### Storage
Uploaded files: `fieldhands/storage/documents/` — UUID filenames, metadata in DB.
