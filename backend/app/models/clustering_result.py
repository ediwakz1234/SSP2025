from sqlalchemy import Column, Integer, String, Float, DateTime, JSON, ForeignKey
from sqlalchemy.sql import func
from app.core.database import Base



class ClusteringResult(Base):
    __tablename__ = "clustering_results"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    business_category = Column(String, nullable=False)
    custom_category = Column(String, nullable=True)  # ✅ optional field for custom category
    num_clusters = Column(Integer, nullable=False)

    # Recommended location
    recommended_latitude = Column(Float(precision=8), nullable=False)
    recommended_longitude = Column(Float(precision=8), nullable=False)
    recommended_zone_type = Column(String, nullable=False)

    # Analysis results
    confidence = Column(Float(precision=4), nullable=False)
    opportunity_level = Column(String, nullable=False)
    total_businesses = Column(Integer, nullable=False)
    competitor_count = Column(Integer, nullable=False)

    # Competitor analysis
    competitors_within_500m = Column(Integer, nullable=False)
    competitors_within_1km = Column(Integer, nullable=False)
    competitors_within_2km = Column(Integer, nullable=False)
    market_saturation = Column(Float(precision=4), nullable=False)
    nearest_competitor_distance = Column(Float(precision=4), nullable=True)

    # Full result data (JSON)
    clusters_data = Column(JSON, nullable=False)
    nearby_businesses = Column(JSON, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    def __repr__(self):
        return f"<ClusteringResult(id={self.id}, category={self.business_category}, user={self.user_id})>"
