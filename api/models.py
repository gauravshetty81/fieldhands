from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, Enum, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from api.database import Base


class UserRole(str, enum.Enum):
    owner     = "owner"
    co_owner  = "co_owner"
    caretaker = "caretaker"
    accountant = "accountant"
    viewer    = "viewer"


class User(Base):
    __tablename__ = "users"

    id           = Column(Integer, primary_key=True)
    username     = Column(String, unique=True, nullable=False)
    email        = Column(String, unique=True, nullable=True)
    full_name    = Column(String, nullable=True)
    password_hash = Column(String, nullable=False)
    role         = Column(Enum(UserRole), nullable=False, default=UserRole.viewer)
    is_active    = Column(Boolean, default=True)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())
    last_login   = Column(DateTime(timezone=True), nullable=True)

    activity_logs = relationship("ActivityLog", back_populates="user")


class LandProfile(Base):
    """Single record describing the land holding."""
    __tablename__ = "land_profile"

    id            = Column(Integer, primary_key=True)
    name          = Column(String, nullable=False, default="My Farm")
    location      = Column(String, nullable=True)        # village/taluk/district
    district      = Column(String, nullable=True)
    state         = Column(String, nullable=True, default="Karnataka")
    area_acres    = Column(Float, nullable=True)
    gps_lat       = Column(Float, nullable=True)
    gps_lng       = Column(Float, nullable=True)
    survey_number = Column(String, nullable=True)
    notes         = Column(Text, nullable=True)
    updated_at    = Column(DateTime(timezone=True), onupdate=func.now())


class Crop(Base):
    """Crops planted on the land."""
    __tablename__ = "crops"

    id          = Column(Integer, primary_key=True)
    name        = Column(String, nullable=False)          # e.g. "Coconut"
    variety     = Column(String, nullable=True)
    count       = Column(Integer, nullable=True)          # number of trees/plants
    area_acres  = Column(Float, nullable=True)
    planted_year = Column(Integer, nullable=True)
    notes       = Column(Text, nullable=True)


class FeatureStatus(str, enum.Enum):
    idea       = "idea"
    planned    = "planned"
    in_progress = "in_progress"
    done       = "done"
    on_hold    = "on_hold"


class FeaturePriority(str, enum.Enum):
    critical = "critical"
    high     = "high"
    medium   = "medium"
    low      = "low"


class RoadmapItem(Base):
    """A feature, use case, or project idea tracked on the roadmap."""
    __tablename__ = "roadmap_items"

    id           = Column(Integer, primary_key=True)
    title        = Column(String, nullable=False)
    description  = Column(Text, nullable=True)       # high-level summary
    details      = Column(Text, nullable=True)        # deeper notes, sub-tasks, ideas
    category     = Column(String, nullable=True)      # e.g. "Documents", "Government", "Automation"
    module       = Column(String, nullable=True)      # linked app module id
    status       = Column(Enum(FeatureStatus), nullable=False, default=FeatureStatus.idea)
    priority     = Column(Enum(FeaturePriority), nullable=False, default=FeaturePriority.medium)
    priority_order = Column(Integer, nullable=True)   # manual sort order within priority
    tags         = Column(JSON, nullable=True)        # list of string tags for search/filter
    linked_modules = Column(JSON, nullable=True)      # list of module ids this touches
    cost_estimate  = Column(Float, nullable=True)     # estimated cost in INR if applicable
    created_by   = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())
    updated_at   = Column(DateTime(timezone=True), onupdate=func.now())


class Document(Base):
    """A land or property document stored in the vault."""
    __tablename__ = "documents"

    id                 = Column(Integer, primary_key=True)
    document_type      = Column(String, nullable=False)       # e.g. "Title Deed"
    title              = Column(String, nullable=True)        # user-provided label
    original_filename  = Column(String, nullable=False)
    file_path          = Column(String, nullable=False)       # relative path under storage/documents/
    file_size_bytes    = Column(Integer, nullable=True)
    mime_type          = Column(String, nullable=True)

    issuing_authority  = Column(String, nullable=True)        # e.g. "Sub-Registrar, Udupi"
    issue_date         = Column(String, nullable=True)        # stored as YYYY-MM-DD string
    expiry_date        = Column(String, nullable=True)        # stored as YYYY-MM-DD string
    survey_number      = Column(String, nullable=True)
    description        = Column(Text, nullable=True)
    notes              = Column(Text, nullable=True)
    tags               = Column(JSON, nullable=True)          # list of strings

    # Cost tracking — flows into Accounting module later
    cost_amount        = Column(Float, nullable=True)         # INR
    cost_description   = Column(String, nullable=True)        # e.g. "Advocate fee"

    uploaded_by        = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at         = Column(DateTime(timezone=True), server_default=func.now())
    updated_at         = Column(DateTime(timezone=True), onupdate=func.now())

    # OCR / analysis fields
    ocr_text              = Column(Text, nullable=True)
    translated_text       = Column(Text, nullable=True)
    extracted_fields      = Column(JSON, nullable=True)     # { "Owner Name": "...", ... }
    analysis_status       = Column(String, nullable=True)   # "pending"|"processing"|"done"|"failed"
    analysis_error        = Column(String, nullable=True)
    analyzed_at           = Column(DateTime(timezone=True), nullable=True)
    manual_transcription  = Column(Text, nullable=True)     # user-typed text for handwritten docs

    uploader = relationship("User", foreign_keys=[uploaded_by])


class ActivityLog(Base):
    """Audit trail of all significant actions across all modules."""
    __tablename__ = "activity_log"

    id          = Column(Integer, primary_key=True)
    user_id     = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    module      = Column(String, nullable=False)          # e.g. "documents", "accounting"
    action      = Column(String, nullable=False)          # e.g. "uploaded", "created", "deleted"
    description = Column(String, nullable=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="activity_logs")
