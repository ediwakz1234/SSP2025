from pydantic import BaseModel
from typing import List, Optional

class ClusteringRequest(BaseModel):
    business_category: str
    num_clusters: int = 5

class ClusterPoint(BaseModel):
    latitude: float
    longitude: float
    business_id: Optional[int] = None
    business_name: Optional[str] = None
    category: Optional[str] = None

class ClusterInfo(BaseModel):
    id: int
    centroid: ClusterPoint
    points: List[ClusterPoint]
    color: str
    business_count: int

class CompetitorAnalysis(BaseModel):
    nearest_competitor: Optional[dict] = None
    distance_to_nearest: Optional[float] = None
    competitors_within_500m: int
    competitors_within_1km: int
    competitors_within_2km: int
    market_saturation: float
    recommended_strategy: str

class NearbyBusiness(BaseModel):
    business_id: int
    business_name: str
    category: str
    street: str
    zone_type: str
    distance: float

class ClusteringResponse(BaseModel):
    clusters: List[ClusterInfo]
    iterations: int
    recommended_location: ClusterPoint
    analysis: dict
    competitor_analysis: CompetitorAnalysis
    zone_type: str
    nearby_businesses: List[NearbyBusiness]
