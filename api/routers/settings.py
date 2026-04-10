from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from api.database import get_db
from api.auth import require_owner, get_current_user
from api.models import LandProfile, Crop, User

router = APIRouter()


# ── Land Profile ──────────────────────────────────────────────────────────────

class LandProfileUpdate(BaseModel):
    name:          Optional[str]   = None
    location:      Optional[str]   = None
    district:      Optional[str]   = None
    state:         Optional[str]   = None
    area_acres:    Optional[float] = None
    gps_lat:       Optional[float] = None
    gps_lng:       Optional[float] = None
    survey_number: Optional[str]   = None
    notes:         Optional[str]   = None


@router.get("/api/settings/land")
def get_land_profile(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    profile = db.query(LandProfile).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Land profile not found")
    return {
        "id":            profile.id,
        "name":          profile.name,
        "location":      profile.location,
        "district":      profile.district,
        "state":         profile.state,
        "area_acres":    profile.area_acres,
        "gps_lat":       profile.gps_lat,
        "gps_lng":       profile.gps_lng,
        "survey_number": profile.survey_number,
        "notes":         profile.notes,
    }


@router.patch("/api/settings/land")
def update_land_profile(body: LandProfileUpdate, db: Session = Depends(get_db), _: User = Depends(require_owner)):
    profile = db.query(LandProfile).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Land profile not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)
    db.commit()
    return {"message": "Land profile updated"}


# ── Crops ─────────────────────────────────────────────────────────────────────

class CropCreate(BaseModel):
    name:         str
    variety:      Optional[str]   = None
    count:        Optional[int]   = None
    area_acres:   Optional[float] = None
    planted_year: Optional[int]   = None
    notes:        Optional[str]   = None


@router.get("/api/settings/crops")
def list_crops(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    crops = db.query(Crop).all()
    return [
        {
            "id":           c.id,
            "name":         c.name,
            "variety":      c.variety,
            "count":        c.count,
            "area_acres":   c.area_acres,
            "planted_year": c.planted_year,
            "notes":        c.notes,
        }
        for c in crops
    ]


@router.post("/api/settings/crops", status_code=201)
def add_crop(body: CropCreate, db: Session = Depends(get_db), _: User = Depends(require_owner)):
    crop = Crop(**body.model_dump())
    db.add(crop)
    db.commit()
    db.refresh(crop)
    return {"id": crop.id, "name": crop.name}


@router.delete("/api/settings/crops/{crop_id}")
def delete_crop(crop_id: int, db: Session = Depends(get_db), _: User = Depends(require_owner)):
    crop = db.query(Crop).filter_by(id=crop_id).first()
    if not crop:
        raise HTTPException(status_code=404, detail="Crop not found")
    db.delete(crop)
    db.commit()
    return {"message": "Deleted"}
