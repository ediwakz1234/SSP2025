from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.models.business import Business
from app.schemas.business import Business as BusinessSchema, BusinessCreate, BusinessUpdate

router = APIRouter()

@router.get("/", response_model=List[BusinessSchema])
async def get_businesses(
    skip: int = 0,
    limit: int = 100,
    category: Optional[str] = None,
    zone_type: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get all businesses with optional filtering"""
    query = db.query(Business)
    
    if category:
        query = query.filter(Business.category == category)
    
    if zone_type:
        query = query.filter(Business.zone_type == zone_type)
    
    businesses = query.offset(skip).limit(limit).all()
    return businesses

@router.get("/categories", response_model=List[str])
async def get_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get all unique business categories"""
    categories = db.query(Business.category).distinct().all()
    return [cat[0] for cat in categories]

@router.get("/statistics")
async def get_statistics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get business statistics"""
    total_businesses = db.query(Business).count()
    total_categories = db.query(Business.category).distinct().count()
    
    commercial_count = db.query(Business).filter(
        Business.zone_type == "Commercial"
    ).count()
    
    residential_count = db.query(Business).filter(
        Business.zone_type == "Residential"
    ).count()
    
    # Category distribution
    from sqlalchemy import func
    category_distribution = db.query(
        Business.category,
        func.count(Business.id).label('count')
    ).group_by(Business.category).order_by(func.count(Business.id).desc()).all()
    
    return {
        "total_businesses": total_businesses,
        "total_categories": total_categories,
        "commercial_zones": commercial_count,
        "residential_zones": residential_count,
        "category_distribution": [
            {"category": cat, "count": count}
            for cat, count in category_distribution
        ]
    }

@router.get("/{business_id}", response_model=BusinessSchema)
async def get_business(
    business_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get a specific business by ID"""
    business = db.query(Business).filter(
        Business.business_id == business_id
    ).first()
    
    if not business:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Business not found"
        )
    
    return business

@router.post("/", response_model=BusinessSchema)
async def create_business(
    business_in: BusinessCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create a new business"""
    # Check if business_id already exists
    existing = db.query(Business).filter(
        Business.business_id == business_in.business_id
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Business ID already exists"
        )
    
    db_business = Business(**business_in.model_dump())
    db.add(db_business)
    db.commit()
    db.refresh(db_business)
    
    return db_business

@router.put("/{business_id}", response_model=BusinessSchema)
async def update_business(
    business_id: int,
    business_update: BusinessUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update a business"""
    business = db.query(Business).filter(
        Business.business_id == business_id
    ).first()
    
    if not business:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Business not found"
        )
    
    update_data = business_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(business, field, value)
    
    db.commit()
    db.refresh(business)
    
    return business

@router.delete("/{business_id}")
async def delete_business(
    business_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Delete a business"""
    business = db.query(Business).filter(
        Business.business_id == business_id
    ).first()
    
    if not business:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Business not found"
        )
    
    db.delete(business)
    db.commit()
    
    return {"message": "Business deleted successfully"}
