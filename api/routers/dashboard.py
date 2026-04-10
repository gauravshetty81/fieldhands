from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import desc
import httpx

from api.database import get_db
from api.auth import get_current_user
from api.models import User, LandProfile, Crop, ActivityLog

router = APIRouter()


@router.get("/api/dashboard")
def get_dashboard(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Returns all data needed to render the dashboard home screen.
    Role-based: caretakers don't see financial snapshot.
    """

    # ── Land profile ───────────────────────────────────────────────────────────
    profile = db.query(LandProfile).first()
    land = None
    if profile:
        land = {
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

    # ── Crops summary ─────────────────────────────────────────────────────────
    crops = db.query(Crop).all()
    crop_summary = [
        {"name": c.name, "variety": c.variety, "count": c.count}
        for c in crops
    ]

    # ── Financial snapshot (owners + accountants only) ─────────────────────────
    financials = None
    if user.role in ("owner", "co_owner", "accountant"):
        # Placeholder until Accounting module is built
        financials = {
            "income_this_month":   0.0,
            "expenses_this_month": 0.0,
            "net_pl":              0.0,
            "currency":            "INR",
        }

    # ── Recent activity ────────────────────────────────────────────────────────
    logs = (
        db.query(ActivityLog)
          .order_by(desc(ActivityLog.created_at))
          .limit(5)
          .all()
    )
    activity = [
        {
            "module":      l.module,
            "action":      l.action,
            "description": l.description,
            "by":          l.user.full_name if l.user else "System",
            "at":          l.created_at.isoformat() if l.created_at else None,
        }
        for l in logs
    ]

    # ── Weather (OpenMeteo — free, no API key) ─────────────────────────────────
    weather = None
    if land and land.get("gps_lat") and land.get("gps_lng"):
        try:
            lat, lng = land["gps_lat"], land["gps_lng"]
            url = (
                f"https://api.open-meteo.com/v1/forecast"
                f"?latitude={lat}&longitude={lng}"
                f"&current=temperature_2m,relative_humidity_2m,"
                f"precipitation,wind_speed_10m,weather_code"
                f"&timezone=Asia%2FKolkata"
            )
            resp = httpx.get(url, timeout=5.0)
            if resp.status_code == 200:
                data = resp.json().get("current", {})
                weather = {
                    "temperature_c":   data.get("temperature_2m"),
                    "humidity_pct":    data.get("relative_humidity_2m"),
                    "precipitation_mm": data.get("precipitation"),
                    "wind_speed_kmh":  data.get("wind_speed_10m"),
                    "weather_code":    data.get("weather_code"),
                }
        except Exception:
            pass  # weather is non-critical — fail silently

    # ── Module quick links (shown to all users; filtered by role on frontend) ──
    modules = [
        {"id": "accounting",   "label": "Accounting",          "icon": "₹", "path": "/accounting"},
        {"id": "documents",    "label": "Document Vault",       "icon": "🗂", "path": "/documents"},
        {"id": "farm",         "label": "Farm Operations",      "icon": "🌴", "path": "/farm"},
        {"id": "automation",   "label": "Automation Planning",  "icon": "⚙️", "path": "/automation"},
        {"id": "compliance",   "label": "Govt & Compliance",    "icon": "📋", "path": "/compliance"},
        {"id": "analytics",    "label": "Analytics",            "icon": "📊", "path": "/analytics"},
    ]

    return {
        "land":        land,
        "crops":       crop_summary,
        "financials":  financials,
        "activity":    activity,
        "weather":     weather,
        "modules":     modules,
    }
