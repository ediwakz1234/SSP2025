from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.models.business import Business
from app.models.clustering_result import ClusteringResult
from app.schemas.clustering import ClusteringRequest, ClusteringResponse
from app.services.clustering_service import perform_kmeans_clustering

router = APIRouter()

@router.post("/analyze", response_model=ClusteringResponse)
async def analyze_clustering(
    request: ClusteringRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Perform K-Means clustering analysis"""
    # Get all businesses from database
    businesses = db.query(Business).all()
    
    if not businesses:
        raise HTTPException(
            status_code=404,
            detail="No businesses found in database"
        )
    
    # Convert to list of dicts
    business_data = [
        {
            "business_id": b.business_id,
            "business_name": b.business_name,
            "category": b.category,
            "latitude": b.latitude,
            "longitude": b.longitude,
            "street": b.street,
            "zone_type": b.zone_type
        }
        for b in businesses
    ]
    
    # Perform clustering analysis
    result = perform_kmeans_clustering(
        businesses=business_data,
        business_category=request.business_category,
        num_clusters=request.num_clusters
    )
    
    # Save result to database
    db_result = ClusteringResult(
        user_id=current_user.id,
        business_category=request.business_category,
        num_clusters=request.num_clusters,
        recommended_latitude=result["recommended_location"]["latitude"],
        recommended_longitude=result["recommended_location"]["longitude"],
        recommended_zone_type=result["zone_type"],
        confidence=result["analysis"]["confidence"],
        opportunity_level=result["analysis"]["opportunity"],
        total_businesses=result["analysis"]["totalBusinesses"],
        competitor_count=result["analysis"]["competitorCount"],
        competitors_within_500m=result["competitor_analysis"]["competitors_within_500m"],
        competitors_within_1km=result["competitor_analysis"]["competitors_within_1km"],
        competitors_within_2km=result["competitor_analysis"]["competitors_within_2km"],
        market_saturation=result["competitor_analysis"]["market_saturation"],
        nearest_competitor_distance=result["competitor_analysis"]["distance_to_nearest"],
        clusters_data=result["clusters"],
        nearby_businesses=result["nearby_businesses"]
    )
    
    db.add(db_result)
    db.commit()
    db.refresh(db_result)
    
    return result

@router.get("/history")
async def get_clustering_history(
    skip: int = 0,
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get user's clustering analysis history"""
    results = db.query(ClusteringResult).filter(
        ClusteringResult.user_id == current_user.id
    ).order_by(ClusteringResult.created_at.desc()).offset(skip).limit(limit).all()
    
    return [
        {
            "id": r.id,
            "business_category": r.business_category,
            "num_clusters": r.num_clusters,
            "confidence": r.confidence,
            "opportunity_level": r.opportunity_level,
            "created_at": r.created_at.isoformat()
        }
        for r in results
    ]

@router.get("/history/{result_id}")
async def get_clustering_result(
    result_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get a specific clustering result"""
    result = db.query(ClusteringResult).filter(
        ClusteringResult.id == result_id,
        ClusteringResult.user_id == current_user.id
    ).first()
    
    if not result:
        raise HTTPException(status_code=404, detail="Result not found")
    
    return {
        "id": result.id,
        "business_category": result.business_category,
        "num_clusters": result.num_clusters,
        "recommended_location": {
            "latitude": result.recommended_latitude,
            "longitude": result.recommended_longitude
        },
        "zone_type": result.recommended_zone_type,
        "analysis": {
            "confidence": result.confidence,
            "opportunity": result.opportunity_level,
            "totalBusinesses": result.total_businesses,
            "competitorCount": result.competitor_count
        },
        "competitor_analysis": {
            "competitors_within_500m": result.competitors_within_500m,
            "competitors_within_1km": result.competitors_within_1km,
            "competitors_within_2km": result.competitors_within_2km,
            "market_saturation": result.market_saturation,
            "distance_to_nearest": result.nearest_competitor_distance
        },
        "clusters": result.clusters_data,
        "nearby_businesses": result.nearby_businesses,
        "created_at": result.created_at.isoformat()
    }
