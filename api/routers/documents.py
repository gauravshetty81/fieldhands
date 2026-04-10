import os
import uuid
import threading
from datetime import date, timedelta
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from api.database import get_db
from api.auth import get_current_user, require_documents
from api.models import Document, ActivityLog, User

# One analysis job at a time
_analysis_lock = threading.Lock()
_analysis_running = False

router = APIRouter()

STORAGE_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "storage", "documents"
)
os.makedirs(STORAGE_DIR, exist_ok=True)

ALLOWED_MIME = {
    "application/pdf",
    "image/jpeg", "image/jpg", "image/png",
    "image/webp", "image/tiff",
}

DOCUMENT_TYPES = [
    "Title Deed / Sale Deed",
    "RTC (Record of Rights)",
    "Katha / Khata",
    "Land Tax Receipt",
    "Survey Sketch",
    "Encumbrance Certificate (EC)",
    "Tippan",
    "Mutation Register",
    "Patta",
    "Power of Attorney",
    "Other",
]


def _serialize(doc: Document) -> dict:
    today = date.today().isoformat()
    expiry = doc.expiry_date
    days_to_expiry = None
    expiry_status = None
    if expiry:
        delta = (date.fromisoformat(expiry) - date.today()).days
        days_to_expiry = delta
        if delta < 0:
            expiry_status = "expired"
        elif delta <= 90:
            expiry_status = "expiring_soon"

    return {
        "id":                doc.id,
        "document_type":     doc.document_type,
        "title":             doc.title,
        "original_filename": doc.original_filename,
        "file_size_bytes":   doc.file_size_bytes,
        "mime_type":         doc.mime_type,
        "issuing_authority": doc.issuing_authority,
        "issue_date":        doc.issue_date,
        "expiry_date":       doc.expiry_date,
        "days_to_expiry":    days_to_expiry,
        "expiry_status":     expiry_status,
        "survey_number":     doc.survey_number,
        "description":       doc.description,
        "notes":             doc.notes,
        "tags":              doc.tags or [],
        "cost_amount":       doc.cost_amount,
        "cost_description":  doc.cost_description,
        "uploaded_by_name":  doc.uploader.full_name or doc.uploader.username if doc.uploader else None,
        "created_at":        doc.created_at.isoformat() if doc.created_at else None,
        "updated_at":        doc.updated_at.isoformat() if doc.updated_at else None,
        "analysis_status":       doc.analysis_status,
        "ocr_text":              doc.ocr_text,
        "translated_text":       doc.translated_text,
        "extracted_fields":      doc.extracted_fields or {},
        "analysis_error":        doc.analysis_error,
        "analyzed_at":           doc.analyzed_at.isoformat() if doc.analyzed_at else None,
        "manual_transcription":  doc.manual_transcription,
    }


def _log(db: Session, user: User, action: str, description: str):
    db.add(ActivityLog(user_id=user.id, module="documents", action=action, description=description))


# ── Upload ────────────────────────────────────────────────────────────────────

@router.post("/api/documents/upload", status_code=201)
async def upload_document(
    file:               UploadFile = File(...),
    document_type:      str = Form(...),
    title:              Optional[str] = Form(None),
    issuing_authority:  Optional[str] = Form(None),
    issue_date:         Optional[str] = Form(None),
    expiry_date:        Optional[str] = Form(None),
    survey_number:      Optional[str] = Form(None),
    description:        Optional[str] = Form(None),
    notes:              Optional[str] = Form(None),
    tags:               Optional[str] = Form(None),   # comma-separated
    cost_amount:        Optional[float] = Form(None),
    cost_description:   Optional[str] = Form(None),
    db:  Session = Depends(get_db),
    user: User   = Depends(require_documents),
):
    if file.content_type not in ALLOWED_MIME:
        raise HTTPException(status_code=400, detail=f"File type not allowed: {file.content_type}. Use PDF or image.")

    content = await file.read()
    if len(content) > 50 * 1024 * 1024:  # 50 MB limit
        raise HTTPException(status_code=400, detail="File too large. Maximum 50 MB.")

    # Save to disk with a unique name to avoid collisions
    ext = os.path.splitext(file.filename or "doc")[1].lower() or ".pdf"
    stored_filename = f"{uuid.uuid4().hex}{ext}"
    abs_path = os.path.join(STORAGE_DIR, stored_filename)
    with open(abs_path, "wb") as f:
        f.write(content)

    tag_list = [t.strip() for t in tags.split(",") if t.strip()] if tags else []

    doc = Document(
        document_type=document_type,
        title=title or file.filename,
        original_filename=file.filename,
        file_path=stored_filename,
        file_size_bytes=len(content),
        mime_type=file.content_type,
        issuing_authority=issuing_authority,
        issue_date=issue_date or None,
        expiry_date=expiry_date or None,
        survey_number=survey_number,
        description=description,
        notes=notes,
        tags=tag_list,
        cost_amount=cost_amount,
        cost_description=cost_description,
        uploaded_by=user.id,
    )
    db.add(doc)
    _log(db, user, "uploaded", f"{document_type} — {title or file.filename}")
    db.commit()
    db.refresh(doc)
    return _serialize(doc)


# ── List ──────────────────────────────────────────────────────────────────────

@router.get("/api/documents")
def list_documents(
    q:             Optional[str] = None,   # search in title, authority, description
    document_type: Optional[str] = None,
    expiry_status: Optional[str] = None,   # "expired" | "expiring_soon"
    db:   Session = Depends(get_db),
    _user: User   = Depends(get_current_user),
):
    docs = db.query(Document).order_by(Document.created_at.desc()).all()
    results = [_serialize(d) for d in docs]

    if q:
        ql = q.lower()
        results = [
            d for d in results
            if ql in (d["title"] or "").lower()
            or ql in (d["issuing_authority"] or "").lower()
            or ql in (d["description"] or "").lower()
            or ql in (d["document_type"] or "").lower()
            or any(ql in t.lower() for t in d["tags"])
        ]
    if document_type:
        results = [d for d in results if d["document_type"] == document_type]
    if expiry_status:
        results = [d for d in results if d["expiry_status"] == expiry_status]

    return results


# ── Download ──────────────────────────────────────────────────────────────────

@router.get("/api/documents/{doc_id}/download")
def download_document(
    doc_id: int,
    db:    Session = Depends(get_db),
    _user: User    = Depends(get_current_user),
):
    doc = db.query(Document).filter_by(id=doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    abs_path = os.path.join(STORAGE_DIR, doc.file_path)
    if not os.path.exists(abs_path):
        raise HTTPException(status_code=404, detail="File not found on disk")

    return FileResponse(
        path=abs_path,
        filename=doc.original_filename,
        media_type=doc.mime_type or "application/octet-stream",
    )


# ── Update metadata ───────────────────────────────────────────────────────────

class DocumentUpdate(BaseModel):
    document_type:     Optional[str]        = None
    title:             Optional[str]        = None
    issuing_authority: Optional[str]        = None
    issue_date:        Optional[str]        = None
    expiry_date:       Optional[str]        = None
    survey_number:     Optional[str]        = None
    description:       Optional[str]        = None
    notes:             Optional[str]        = None
    tags:              Optional[List[str]]  = None
    cost_amount:       Optional[float]      = None
    cost_description:  Optional[str]        = None


@router.patch("/api/documents/{doc_id}")
def update_document(
    doc_id: int,
    body:  DocumentUpdate,
    db:    Session = Depends(get_db),
    user:  User    = Depends(require_documents),
):
    doc = db.query(Document).filter_by(id=doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(doc, field, value)
    _log(db, user, "updated", f"Edited metadata for: {doc.title or doc.original_filename}")
    db.commit()
    db.refresh(doc)
    return _serialize(doc)


# ── Delete ────────────────────────────────────────────────────────────────────

@router.delete("/api/documents/{doc_id}")
def delete_document(
    doc_id: int,
    db:    Session = Depends(get_db),
    user:  User    = Depends(require_documents),
):
    doc = db.query(Document).filter_by(id=doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Remove file from disk
    abs_path = os.path.join(STORAGE_DIR, doc.file_path)
    if os.path.exists(abs_path):
        os.remove(abs_path)

    _log(db, user, "deleted", f"Deleted: {doc.title or doc.original_filename}")
    db.delete(doc)
    db.commit()
    return {"message": "Deleted"}


# ── Document types list ───────────────────────────────────────────────────────

@router.get("/api/documents/types")
def list_document_types(_: User = Depends(get_current_user)):
    return DOCUMENT_TYPES


# ── Analyze (OCR + translation) ───────────────────────────────────────────────

def _run_analysis(doc_id: int):
    """Background task: run OCR + translation, persist results."""
    global _analysis_running
    from api.database import SessionLocal
    from api.services.analyzer import analyze_document

    db = SessionLocal()
    try:
        doc = db.query(Document).filter_by(id=doc_id).first()
        if not doc:
            return

        abs_path = os.path.join(STORAGE_DIR, doc.file_path)
        result = analyze_document(abs_path, doc.mime_type or "application/octet-stream", doc.document_type or "")

        doc.ocr_text = result["ocr_text"]
        doc.translated_text = result["translated_text"]
        doc.extracted_fields = result["extracted_fields"]
        doc.analysis_status = "done"
        doc.analysis_error = None
        doc.analyzed_at = datetime.now(timezone.utc)
        db.add(ActivityLog(
            user_id=doc.uploaded_by,
            module="documents",
            action="analyzed",
            description=f"Analysis complete ({result['method_used']}): {doc.title or doc.original_filename}",
        ))
        db.commit()
    except MemoryError as e:
        doc = db.query(Document).filter_by(id=doc_id).first()
        if doc:
            doc.analysis_status = "failed"
            doc.analysis_error = str(e)
            db.commit()
    except Exception as e:
        db = SessionLocal()
        doc = db.query(Document).filter_by(id=doc_id).first()
        if doc:
            doc.analysis_status = "failed"
            doc.analysis_error = f"Analysis failed: {str(e)}"
            db.commit()
    finally:
        db.close()
        with _analysis_lock:
            _analysis_running = False


@router.post("/api/documents/{doc_id}/analyze", status_code=202)
def start_analysis(
    doc_id: int,
    background_tasks: BackgroundTasks,
    db:   Session = Depends(get_db),
    user: User    = Depends(require_documents),
):
    global _analysis_running

    doc = db.query(Document).filter_by(id=doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    abs_path = os.path.join(STORAGE_DIR, doc.file_path)
    if not os.path.exists(abs_path):
        raise HTTPException(status_code=404, detail="File not found on disk")

    with _analysis_lock:
        if _analysis_running:
            raise HTTPException(
                status_code=409,
                detail="Another analysis is already running. Please wait for it to finish.",
            )
        _analysis_running = True

    doc.analysis_status = "processing"
    doc.analysis_error = None
    db.commit()

    background_tasks.add_task(_run_analysis, doc_id)
    return {"status": "processing", "message": "Analysis started"}


@router.get("/api/documents/{doc_id}/analysis")
def get_analysis(
    doc_id: int,
    db:    Session = Depends(get_db),
    _user: User    = Depends(get_current_user),
):
    doc = db.query(Document).filter_by(id=doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    return {
        "analysis_status":      doc.analysis_status,
        "ocr_text":             doc.ocr_text,
        "translated_text":      doc.translated_text,
        "extracted_fields":     doc.extracted_fields or {},
        "analysis_error":       doc.analysis_error,
        "analyzed_at":          doc.analyzed_at.isoformat() if doc.analyzed_at else None,
        "manual_transcription": doc.manual_transcription,
    }


@router.patch("/api/documents/{doc_id}/transcription")
def save_transcription(
    doc_id: int,
    body: dict,
    db:   Session = Depends(get_db),
    user: User    = Depends(require_documents),
):
    doc = db.query(Document).filter_by(id=doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    doc.manual_transcription = body.get("text", "")
    _log(db, user, "transcribed", f"Manual transcription saved: {doc.title or doc.original_filename}")
    db.commit()
    return {"manual_transcription": doc.manual_transcription}
