from pydantic import BaseModel, EmailStr
from datetime import datetime ,date
from typing import Optional

# ✅ Base shared properties
class UserBase(BaseModel):
    email: EmailStr
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone_number: Optional[str] = None

    address: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    date_of_birth: date  # ✅ add this


# ✅ For registration
class UserCreate(UserBase):
    password: str

# ✅ For updates
class UserUpdate(UserBase):
    password: Optional[str] = None

# ✅ For DB and internal use
class UserInDB(UserBase):
    id: int
    is_active: bool
    is_superuser: bool
    created_at: datetime

    class Config:
        orm_mode = True  # ✅ Enables SQLAlchemy → Pydantic conversion

# ✅ For API responses
class UserResponse(UserBase):
    id: int
    is_active: bool

    class Config:
        orm_mode = True  # ✅ Same as before, but using correct field names

# ✅ Full internal model (optional)
class User(UserInDB):
    pass
