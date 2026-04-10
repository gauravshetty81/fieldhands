from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional, List
from api.database import get_db
from api.auth import get_current_user, require_owner
from api.models import RoadmapItem, FeatureStatus, FeaturePriority, User

router = APIRouter()


class RoadmapItemCreate(BaseModel):
    title:           str
    description:     Optional[str]       = None
    details:         Optional[str]       = None
    category:        Optional[str]       = None
    module:          Optional[str]       = None
    status:          FeatureStatus       = FeatureStatus.idea
    priority:        FeaturePriority     = FeaturePriority.medium
    priority_order:  Optional[int]       = None
    tags:            Optional[List[str]] = None
    linked_modules:  Optional[List[str]] = None
    cost_estimate:   Optional[float]     = None


class RoadmapItemUpdate(BaseModel):
    title:           Optional[str]       = None
    description:     Optional[str]       = None
    details:         Optional[str]       = None
    category:        Optional[str]       = None
    module:          Optional[str]       = None
    status:          Optional[FeatureStatus]   = None
    priority:        Optional[FeaturePriority] = None
    priority_order:  Optional[int]       = None
    tags:            Optional[List[str]] = None
    linked_modules:  Optional[List[str]] = None
    cost_estimate:   Optional[float]     = None


def _serialize(item: RoadmapItem) -> dict:
    return {
        "id":             item.id,
        "title":          item.title,
        "description":    item.description,
        "details":        item.details,
        "category":       item.category,
        "module":         item.module,
        "status":         item.status,
        "priority":       item.priority,
        "priority_order": item.priority_order,
        "tags":           item.tags or [],
        "linked_modules": item.linked_modules or [],
        "cost_estimate":  item.cost_estimate,
        "created_at":     item.created_at.isoformat() if item.created_at else None,
        "updated_at":     item.updated_at.isoformat() if item.updated_at else None,
    }


@router.get("/api/roadmap")
def list_roadmap(
    status:   Optional[str] = None,
    category: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(RoadmapItem)
    if status:   q = q.filter(RoadmapItem.status == status)
    if category: q = q.filter(RoadmapItem.category == category)
    items = q.order_by(
        RoadmapItem.priority_order.asc().nullslast(),
        RoadmapItem.created_at.desc()
    ).all()
    return [_serialize(i) for i in items]


@router.get("/api/roadmap/{item_id}")
def get_roadmap_item(item_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    item = db.query(RoadmapItem).filter_by(id=item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return _serialize(item)


@router.post("/api/roadmap", status_code=201)
def create_roadmap_item(
    body: RoadmapItemCreate,
    db:   Session = Depends(get_db),
    user: User    = Depends(require_owner),
):
    item = RoadmapItem(**body.model_dump(), created_by=user.id)
    db.add(item)
    db.commit()
    db.refresh(item)
    return _serialize(item)


@router.patch("/api/roadmap/{item_id}")
def update_roadmap_item(
    item_id: int,
    body:    RoadmapItemUpdate,
    db:      Session = Depends(get_db),
    _:       User    = Depends(require_owner),
):
    item = db.query(RoadmapItem).filter_by(id=item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    db.commit()
    return _serialize(item)


@router.delete("/api/roadmap/{item_id}")
def delete_roadmap_item(item_id: int, db: Session = Depends(get_db), _: User = Depends(require_owner)):
    item = db.query(RoadmapItem).filter_by(id=item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(item)
    db.commit()
    return {"message": "Deleted"}
