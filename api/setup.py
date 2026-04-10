"""
setup.py — seed the database with initial data.

Run after migrations:
    python3.11 -m api.setup

Creates:
  - Admin user (owner role) — prompts for password
  - Land profile for Udupi farm
  - Initial crops (100 coconut trees, betel nut)
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from passlib.context import CryptContext
from api.database import SessionLocal, engine
from api.models import Base, User, UserRole, LandProfile, Crop

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def main():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # ── Admin user ─────────────────────────────────────────────────────────────
    if not db.query(User).filter_by(username="admin").first():
        password = input("Set admin password: ").strip()
        if not password:
            print("Password cannot be empty.")
            sys.exit(1)
        user = User(
            username="admin",
            full_name="Admin",
            password_hash=pwd_context.hash(password),
            role=UserRole.owner,
        )
        db.add(user)
        print("✓ Admin user created (role: owner)")
    else:
        print("  Admin user already exists, skipping.")

    # ── Land profile ───────────────────────────────────────────────────────────
    if not db.query(LandProfile).first():
        profile = LandProfile(
            name="Udupi Farm",
            location="Udupi",
            district="Udupi",
            state="Karnataka",
            area_acres=0.8,
            gps_lat=13.3409,   # approximate Udupi coordinates
            gps_lng=74.7421,
            notes="Inherited family land. 100 coconut trees and betel nut.",
        )
        db.add(profile)
        print("✓ Land profile created")
    else:
        print("  Land profile already exists, skipping.")

    # ── Crops ──────────────────────────────────────────────────────────────────
    if not db.query(Crop).first():
        db.add(Crop(name="Coconut", variety="West Coast Tall", count=100))
        db.add(Crop(name="Betel Nut", variety="Mangala", count=None))
        print("✓ Crops seeded (Coconut × 100, Betel Nut)")
    else:
        print("  Crops already exist, skipping.")

    db.commit()
    db.close()
    print("\nSetup complete. Run: uvicorn api.main:app --host 127.0.0.1 --port 8001 --reload")


if __name__ == "__main__":
    main()
