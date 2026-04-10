# Fieldhands

A private land management application for tracking, organizing, and understanding agricultural land records — built for an inherited 0.8 acre farm near Udupi, Karnataka.

---

## What it does

- **Document Vault** — Upload and store land documents (PDFs, photos). Supports Title Deed, RTC, Katha, EC, Patta, Mutation Register, Land Tax Receipt, and more.
- **Local OCR + Kannada Translation** — Extract text from scanned documents and photos entirely on your machine. No data sent anywhere. Translates Kannada to English.
- **Template-Based Field Extraction** — Recognizes known Karnataka government document formats (BBMP Khata, RTC, EC, etc.) and extracts structured fields: owner name, survey number, plot area, boundaries, issue date, etc.
- **Manual Transcription** — For handwritten documents that OCR can't read, type what the document says and store it alongside the file.
- **Roadmap Tracker** — Track features, ideas, and planned improvements with priority and status.
- **Farm Profile** — Store land details: GPS coordinates, area, survey number, crops.
- **Role-Based Access** — Owner, co-owner, caretaker, accountant, and viewer roles with appropriate permissions.
- **Activity Log** — Audit trail of all uploads, edits, and deletions.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI, SQLAlchemy, Alembic, PostgreSQL |
| Frontend | React, TypeScript, Vite, Tailwind CSS v4 |
| Auth | JWT (python-jose), bcrypt |
| OCR | EasyOCR (Kannada + English, local) |
| Translation | facebook/nllb-200-distilled-600M (local, ~1.3GB) |
| PDF extraction | pdfplumber, pdf2image + poppler |
| Image preprocessing | OpenCV |
| Database | PostgreSQL 15 via Docker |
| Weather | OpenMeteo API (free, no key required) |

---

## Project Structure

```
fieldhands/
├── api/
│   ├── main.py              # FastAPI app, CORS, router registration
│   ├── auth.py              # JWT auth, role guards
│   ├── models.py            # SQLAlchemy models
│   ├── database.py          # DB session
│   ├── config.py            # Settings (from .env)
│   ├── setup.py             # Seed script (admin user, land profile, crops)
│   ├── routers/
│   │   ├── documents.py     # Document vault endpoints + OCR analysis
│   │   ├── dashboard.py     # Dashboard data
│   │   ├── roadmap.py       # Roadmap CRUD
│   │   ├── settings.py      # Land profile settings
│   │   └── users.py         # User management
│   └── services/
│       ├── analyzer.py      # OCR pipeline (pdfplumber → EasyOCR, preprocessing, translation)
│       └── templates.py     # Government document field extractors
├── frontend/
│   └── src/
│       ├── pages/           # DocumentsPage, DashboardPage, RoadmapPage, etc.
│       ├── components/      # Layout, WeatherWidget
│       └── api.ts           # Axios instance, types
├── migrations/              # Alembic migration files
├── storage/                 # Uploaded documents (gitignored — stays local)
├── docker-compose.yml       # PostgreSQL container
├── requirements.txt         # Python dependencies
├── .env.example             # Environment variable template
└── JOURNAL.md               # Project decisions and change log
```

---

## Setup

### Prerequisites

- Python 3.11
- Node.js 18+
- Docker Desktop
- poppler (`brew install poppler` on macOS)

### 1. Clone and install

```bash
git clone https://github.com/gauravshetty81/fieldhands.git
cd fieldhands
pip3.11 install -r requirements.txt
pip3.11 install easyocr pdf2image transformers torch sentencepiece sacremoses psutil
cd frontend && npm install && cd ..
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:
```
DB_PASSWORD=choose_a_password
SECRET_KEY=any_long_random_string
DB_URL=postgresql://fieldhands_user:choose_a_password@localhost:5434/fieldhands
```

### 3. Start the database

```bash
docker compose up -d
```

### 4. Run database migrations

```bash
python3.11 -m alembic upgrade head
```

### 5. Create the admin user and seed data

```bash
python3.11 -m api.setup
```

This creates the admin user (you'll be prompted for a password), seeds the land profile (Udupi area, 0.8 acres, 100 coconut trees), and sets up initial crops.

### 6. Start the servers

```bash
# API (port 8001)
python3.11 -m uvicorn api.main:app --host 0.0.0.0 --port 8001 --reload

# Frontend (port 5173) — in a separate terminal
cd frontend && npm run dev
```

Open `http://localhost:5173` and log in with the admin credentials you set.

---

## Using the dev script

A convenience script in the parent directory manages startup/shutdown:

```bash
./dev.sh startup fieldhands    # starts DB, API, and frontend
./dev.sh shutdown fieldhands   # stops everything
./dev.sh status                # show what's running
```

Logs are written to `/tmp/dev-logs/fieldhands-api.log` and `fieldhands-frontend.log`.

---

## Document Analysis (OCR)

After uploading a document, open it and click **Analyze Document**. The analysis runs entirely on your machine — nothing is sent to any external service.

**How it works:**
1. For digital PDFs — pdfplumber extracts text directly
2. For scanned PDFs and images — EasyOCR reads the rendered page
3. For PDFs with non-Unicode Kannada fonts (common in government PDFs) — automatically falls back to EasyOCR
4. Phone photos — preprocessed with OpenCV (background removal, perspective correction, contrast enhancement) before OCR
5. Kannada text is translated to English using the NLLB-200 model (downloads ~1.3GB on first use, cached locally)
6. For known document types, structured fields are extracted using template matching

**On first analysis:**
- EasyOCR downloads Kannada + English model weights (~500MB) → cached at `~/.EasyOCR/`
- NLLB translation model downloads (~1.3GB) → cached at `~/.cache/huggingface/`
- Subsequent analyses are fast — models don't re-download

**RAM requirement:** ~2GB free RAM during analysis. The app checks before starting and will warn you if memory is low.

### Supported document templates (structured field extraction)

| Document Type | Fields Extracted |
|---|---|
| Katha / Khata (BBMP) | Document number, district, city, property type, site number, PID, plot area, dimensions, address, boundaries, owner name, Aadhaar, issued by, issue date, challan |
| RTC (Record of Rights) | Survey number, hissa, village, hobli, taluk, owner, area, soil type, crops, irrigation, liabilities |
| Encumbrance Certificate | EC number, property description, survey number, period, encumbrances, issued by |
| Land Tax Receipt | Receipt number, owner, survey number, tax amount, payment date |
| Mutation Register | Mutation number, survey number, previous/new owner, reason, date |
| Patta | Patta number, owner, survey number, area, land type |

For document types without a template (Title Deed, Survey Sketch, Power of Attorney, etc.) — the raw OCR text and general Kannada translation are still available.

### Handwritten documents

For old handwritten documents that OCR cannot reliably read, use the **Manual Transcription** field in the document detail view. Type what the document says (Kannada or English) and save — this is stored alongside the file and used for search and translation.

To type Kannada on macOS, enable the Kannada keyboard input source in System Settings → Keyboard → Input Sources.

---

## Roles

| Role | Documents | Financials | Farm | Users |
|---|---|---|---|---|
| owner | ✓ full | ✓ full | ✓ full | ✓ manage |
| co_owner | ✓ full | ✓ full | ✓ full | — |
| caretaker | view only | — | ✓ full | — |
| accountant | view only | ✓ full | — | — |
| viewer | view only | — | — | — |

---

## Ports

| Service | Port |
|---|---|
| Frontend | 5173 |
| API | 8001 |
| PostgreSQL | 5434 |
| API docs (Swagger) | 8001/api/docs |

---

## Storage

Uploaded documents are stored at `storage/documents/` with UUID filenames. This directory is gitignored — your land records never leave your machine. Metadata (document type, dates, OCR results, extracted fields) is stored in PostgreSQL.

---

## Project Journal

[JOURNAL.md](./JOURNAL.md) contains a full log of all design decisions, changes made, and issues resolved across development sessions — useful for understanding why things were built the way they were.
