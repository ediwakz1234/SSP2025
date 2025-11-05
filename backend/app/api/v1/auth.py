from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
from fastapi import BackgroundTasks
from app.utils.email import send_reset_email
from app.core.security import get_current_active_user



from app.core.database import get_db
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token
)
from app.core.config import settings
from app.models.user import User
from app.schemas.user import UserCreate, UserResponse,User as UserSchema
from app.schemas.token import Token
from fastapi import status

router = APIRouter()

@router.post("/register")
def register_user(user: UserCreate, db: Session = Depends(get_db)):
    existing_user = db.query(User).filter(User.email == user.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed_password = get_password_hash(user.password)
    new_user = User(
        username=f"{user.first_name.lower()}{user.last_name.lower()}",
        email=user.email,
        hashed_password=hashed_password,
        first_name=user.first_name,
        last_name=user.last_name,
       phone_number=user.phone_number,
        address=user.address,
        age=user.age,
        gender=user.gender,
        date_of_birth=user.date_of_birth,
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    access_token = create_access_token(data={"sub": new_user.email})

    # ✅ Add a clear message field for frontend toast
    return {
        "message": "🎉 Registration successful! Welcome aboard.",
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": new_user.id,
            "email": new_user.email,
            "first_name": new_user.first_name,
            "last_name": new_user.last_name,
        },
    }


@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """Login user and return access token"""
    # Find user by email (username field is email)
    user = db.query(User).filter(User.email == form_data.username).first()

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )

    # ✅ Create JWT token
    access_token = create_access_token(data={"sub": user.email})

    # ✅ Return token + basic user info
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "phone_number": user.phone_number, 
            "address": user.address,
            "age": user.age,
            "gender": user.gender,
            
        },
    }



    
@router.post("/request-password-reset")
async def request_password_reset(email: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Send a password reset link to user's email."""
    user = db.query(User).filter(User.email == email).first()
    if not user:
        # Don't reveal if user exists or not
        return {"message": "If that email exists, a reset link has been sent."}

    reset_token = create_access_token(
        data={"sub": user.email},
        expires_delta=timedelta(hours=1)  # token valid for 1 hour
    )

    reset_link = f"http://localhost:5173/reset-password?token={reset_token}"
    background_tasks.add_task(send_reset_email, user.email, reset_link)

    return {"message": "If that email exists, a reset link has been sent."}


@router.post("/reset-password")
async def reset_password(token: str, new_password: str, db: Session = Depends(get_db)):
    """Verify token and update user password."""
    from jose import JWTError, jwt

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=400, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=400, detail="Invalid or expired token")

    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.hashed_password = get_password_hash(new_password)
    db.commit()
   
    
    # Create access token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "is_active": user.is_active,
            "created_at": user.created_at.isoformat()
            
        }
        
    }

@router.post("/request-password-reset")
async def request_password_reset(email: str, db: Session = Depends(get_db)):
    """Request password reset (mock implementation)"""
    # In production, this would send an email
    user = db.query(User).filter(User.email == email).first()
    
    # Don't reveal if user exists for security
    return {"message": "If the email exists, a password reset link has been sent"}

@router.get("/verify")
async def verify_token(current_user: User = Depends(get_current_active_user)):
    return {"status": "valid", "user": current_user.email}
