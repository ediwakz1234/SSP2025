from fastapi import APIRouter, Depends, HTTPException, UploadFile, File , Query
from sqlalchemy.orm import Session
from fastapi.responses import StreamingResponse
from typing import Optional
from pydantic import BaseModel, Field, validator
import re, io, csv , json
from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.business import Business
from app.models.clustering_result import ClusteringResult
from app.models.user import User

router = APIRouter()

class ClusteringRequest(BaseModel):
    business_category: str = Field(..., description="Selected business category (or 'custom')")
    custom_category: Optional[str] = Field(None, description="Custom business category if applicable")
    num_clusters: int = Field(5, ge=2, le=10, description="Number of clusters (2–10)")

    @validator("business_category")
    def validate_category(cls, v):
        if not v or not v.strip():
            raise ValueError("Business category is required.")
        return v.strip()

    @validator("custom_category", always=True)
    def validate_custom_category(cls, v, values):
        if values.get("business_category", "").lower() == "custom":
            if not v or not v.strip():
                raise ValueError("Custom category name is required for custom category.")
            if not re.match(r"^[A-Za-z0-9\s&'-]+$", v):
                raise ValueError("Custom category name contains invalid characters.")
        return v


@router.post("/import")
async def import_businesses(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Upload and import business data (CSV) with duplicate prevention."""
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported.")

    try:
        content = await file.read()
        text = content.decode("utf-8")
        reader = csv.DictReader(io.StringIO(text))

        imported_count = 0
        skipped_count = 0

        for row in reader:
            # Basic field validation
            if not row.get("business_name") or not row.get("latitude") or not row.get("longitude"):
                skipped_count += 1
                continue

            # Convert types safely
            try:
                latitude = float(row["latitude"])
                longitude = float(row["longitude"])
            except ValueError:
                skipped_count += 1
                continue

            # Check if a business with the same name and coordinates already exists
            existing = (
                db.query(Business)
                .filter(
                    Business.business_name == row["business_name"],
                    Business.latitude == latitude,
                    Business.longitude == longitude,
                )
                .first()
            )
            if existing:
                skipped_count += 1
                continue

            # Add new business entry
            new_business = Business(
                business_name=row["business_name"],
                category=row.get("category", "Unknown"),
                latitude=latitude,
                longitude=longitude,
                street=row.get("street", ""),
                zone_type=row.get("zone_type", "Unspecified"),
            )
            db.add(new_business)
            imported_count += 1

        db.commit()

        return {
            "message": f"✅ Imported {imported_count} new businesses.",
            "skipped": skipped_count,
            "note": "Duplicate entries were automatically ignored.",
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error importing data: {str(e)}")


# ==============================
# 📥 EXPORT LATEST CLUSTERING RESULT
# ==============================
@router.get("/export/latest")
async def export_latest_result(
    format: str = Query("csv", description="Export format: csv | json | report"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Export the user's latest clustering result in CSV, JSON, or Text format."""
    result = (
        db.query(ClusteringResult)
        .filter(ClusteringResult.user_id == current_user.id)
        .order_by(ClusteringResult.created_at.desc())
        .first()
    )

    if not result:
        raise HTTPException(status_code=404, detail="No clustering results found for this user.")

    # ===============================
    # 1️⃣ JSON EXPORT
    # ===============================
    if format == "json":
        return JSONResponse(
            content={
                "business_category": result.business_category,
                "recommended_location": {
                    "latitude": result.recommended_latitude,
                    "longitude": result.recommended_longitude
                },
                "zone_type": result.recommended_zone_type,
                "opportunity_level": result.opportunity_level,
                "confidence": result.confidence,
                "competitors": {
                    "within_500m": result.competitors_within_500m,
                    "within_1km": result.competitors_within_1km,
                    "within_2km": result.competitors_within_2km,
                }
            }
        )

    # ===============================
    # 2️⃣ TEXT / REPORT EXPORT
    # ===============================
    elif format == "report":
        report = f"""
        🧠 K-Means Clustering Report
        ============================
        Business Category: {result.business_category}
        Recommended Latitude: {result.recommended_latitude}
        Recommended Longitude: {result.recommended_longitude}
        Zone Type: {result.recommended_zone_type}
        Opportunity Level: {result.opportunity_level}
        Confidence: {result.confidence}%

        Competitor Analysis:
        - Within 500m: {result.competitors_within_500m}
        - Within 1km: {result.competitors_within_1km}
        - Within 2km: {result.competitors_within_2km}

        Total Businesses Analyzed: {result.total_businesses}
        Market Saturation: {result.market_saturation}
        Distance to Nearest Competitor: {result.nearest_competitor_distance}m
        """
        return PlainTextResponse(
            content=report.strip(),
            headers={
                "Content-Disposition": "attachment; filename=clustering_report.txt"
            },
        )

    # ===============================
    # 3️⃣ DEFAULT CSV EXPORT
    # ===============================
    elif format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "Business Category",
            "Latitude",
            "Longitude",
            "Zone Type",
            "Opportunity",
            "Confidence",
            "Competitors 500m",
            "Competitors 1km",
            "Competitors 2km",
            "Market Saturation",
            "Nearest Competitor Distance (m)"
        ])
        writer.writerow([
            result.business_category,
            result.recommended_latitude,
            result.recommended_longitude,
            result.recommended_zone_type,
            result.opportunity_level,
            result.confidence,
            result.competitors_within_500m,
            result.competitors_within_1km,
            result.competitors_within_2km,
            result.market_saturation,
            result.nearest_competitor_distance
        ])
        output.seek(0)
        headers = {"Content-Disposition": "attachment; filename=clustering_result.csv"}
        return StreamingResponse(output, media_type="text/csv", headers=headers)

    else:
        raise HTTPException(status_code=400, detail="Invalid format. Use csv, json, or report.")