from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.models.business import Business

router = APIRouter()

@router.get("/category-distribution")
async def get_category_distribution(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get business distribution by category"""
    distribution = db.query(
        Business.category,
        func.count(Business.id).label('count')
    ).group_by(Business.category).order_by(func.count(Business.id).desc()).all()
    
    return [
        {"category": cat, "count": count}
        for cat, count in distribution
    ]

@router.get("/zone-distribution")
async def get_zone_distribution(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get business distribution by zone type"""
    distribution = db.query(
        Business.zone_type,
        func.count(Business.id).label('count')
    ).group_by(Business.zone_type).all()
    
    return [
        {"zone_type": zone, "count": count}
        for zone, count in distribution
    ]

@router.get("/street-distribution")
async def get_street_distribution(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get top streets by business count"""
    distribution = db.query(
        Business.street,
        func.count(Business.id).label('count')
    ).group_by(Business.street).order_by(func.count(Business.id).desc()).limit(10).all()
    
    return [
        {"street": street, "count": count}
        for street, count in distribution
    ]

@router.get("/overview")
async def get_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get overall analytics overview"""
    total_businesses = db.query(Business).count()
    total_categories = db.query(Business.category).distinct().count()
    
    commercial_count = db.query(Business).filter(
        Business.zone_type == "Commercial"
    ).count()
    
    residential_count = db.query(Business).filter(
        Business.zone_type == "Residential"
    ).count()
    
    # Top category
    top_category = db.query(
        Business.category,
        func.count(Business.id).label('count')
    ).group_by(Business.category).order_by(func.count(Business.id).desc()).first()
    
    # Top street
    top_street = db.query(
        Business.street,
        func.count(Business.id).label('count')
    ).group_by(Business.street).order_by(func.count(Business.id).desc()).first()
    
    return {
        "total_businesses": total_businesses,
        "total_categories": total_categories,
        "commercial_zones": commercial_count,
        "residential_zones": residential_count,
        "avg_per_category": round(total_businesses / total_categories, 1) if total_categories > 0 else 0,
        "top_category": {
            "name": top_category[0] if top_category else None,
            "count": top_category[1] if top_category else 0
        },
        "top_street": {
            "name": top_street[0] if top_street else None,
            "count": top_street[1] if top_street else 0
        }
    }
