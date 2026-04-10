from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional
from passlib.context import CryptContext

from api.database import get_db
from api.auth import require_owner
from api.models import User, UserRole

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class CreateUserRequest(BaseModel):
    username:  str
    full_name: Optional[str] = None
    email:     Optional[str] = None
    password:  str
    role:      UserRole = UserRole.viewer


class UpdateUserRequest(BaseModel):
    full_name:  Optional[str] = None
    email:      Optional[str] = None
    role:       Optional[UserRole] = None
    is_active:  Optional[bool] = None
    password:   Optional[str] = None


@router.get("/api/users")
def list_users(db: Session = Depends(get_db), _: User = Depends(require_owner)):
    users = db.query(User).order_by(User.id).all()
    return [
        {
            "id":         u.id,
            "username":   u.username,
            "full_name":  u.full_name,
            "email":      u.email,
            "role":       u.role,
            "is_active":  u.is_active,
            "last_login": u.last_login.isoformat() if u.last_login else None,
        }
        for u in users
    ]


@router.post("/api/users", status_code=201)
def create_user(body: CreateUserRequest, db: Session = Depends(get_db), _: User = Depends(require_owner)):
    if db.query(User).filter_by(username=body.username).first():
        raise HTTPException(status_code=409, detail="Username already taken")
    user = User(
        username=body.username,
        full_name=body.full_name,
        email=body.email,
        password_hash=pwd_context.hash(body.password),
        role=body.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"id": user.id, "username": user.username, "role": user.role}


@router.patch("/api/users/{user_id}")
def update_user(user_id: int, body: UpdateUserRequest, db: Session = Depends(get_db), _: User = Depends(require_owner)):
    user = db.query(User).filter_by(id=user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if body.full_name  is not None: user.full_name  = body.full_name
    if body.email      is not None: user.email      = body.email
    if body.role       is not None: user.role       = body.role
    if body.is_active  is not None: user.is_active  = body.is_active
    if body.password:               user.password_hash = pwd_context.hash(body.password)
    db.commit()
    return {"message": "Updated"}


@router.delete("/api/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), current: User = Depends(require_owner)):
    if user_id == current.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    user = db.query(User).filter_by(id=user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
    return {"message": "Deleted"}
