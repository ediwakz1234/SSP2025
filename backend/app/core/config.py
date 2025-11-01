from pydantic_settings import BaseSettings
from typing import List
import os

class Settings(BaseSettings):
    # App Configuration
    APP_NAME: str = "Strategic Store Placement API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    
    # Database
    # PostgreSQL connection string format:
    # postgresql://username:password@localhost:5432/database_name
    # SQLite (default for development):
    # sqlite:///./store_placement.db
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://postgres:admin1@localhost:5432/store_placement_db")
    
    # Security - IMPORTANT: Change this in production!
    # Generate a secure key with: python -c "import secrets; print(secrets.token_urlsafe(32))"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "afc23c7c12421ff013a114e3a78766f5dabc2e1118b30ba5074a2cbf7c4f574f")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    
    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:5173"]
    
    # Location Info
    LOCATION_BARANGAY: str = "Sta. Cruz"
    LOCATION_MUNICIPALITY: str = "Santa Maria"
    LOCATION_PROVINCE: str = "Bulacan"
    LOCATION_REGION: str = "Central Luzon (Region III)"
    LOCATION_POSTAL_CODE: str = "3022"
    LOCATION_POPULATION: int = 11364
    LOCATION_CENTER_LAT: float = 14.8373
    LOCATION_CENTER_LON: float = 120.9558


        # ✅ Add these lines
    MAIL_USERNAME: str | None = None
    MAIL_PASSWORD: str | None = None
    MAIL_FROM: str | None = None
    MAIL_PORT: int = 587
    MAIL_SERVER: str = "smtp.gmail.com"
    MAIL_TLS: bool = True
    MAIL_SSL: bool = False
    
    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
