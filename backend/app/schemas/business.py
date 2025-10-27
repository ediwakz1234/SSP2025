from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class BusinessBase(BaseModel):
    business_id: int
    business_name: str
    category: str
    latitude: float
    longitude: float
    street: str
    zone_type: str

class BusinessCreate(BusinessBase):
    pass

class BusinessUpdate(BaseModel):
    business_name: Optional[str] = None
    category: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    street: Optional[str] = None
    zone_type: Optional[str] = None

class Business(BusinessBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True
