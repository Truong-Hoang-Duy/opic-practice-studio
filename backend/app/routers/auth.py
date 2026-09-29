from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.config import settings
from app.models.user import User
from app.schemas.auth import UserRegister, UserLogin, Token, UserResponse
from app.core.security import verify_password, get_password_hash, create_access_token, get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])

DEFAULT_EMAIL = "candidate@opicstudio.com"
DEFAULT_NAME = "OPIc Candidate"
DEFAULT_PASSWORD = "password123"

@router.post("/default-login", response_model=Token)
def default_login(db: Session = Depends(get_db)):
    """Logs in or auto-creates the default candidate account."""
    user = db.query(User).filter(User.email == DEFAULT_EMAIL).first()
    if not user:
        user = User(
            email=DEFAULT_EMAIL,
            full_name=DEFAULT_NAME,
            hashed_password=get_password_hash(DEFAULT_PASSWORD)
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    token = create_access_token({"sub": str(user.id)})
    return Token(
        access_token=token,
        token_type="bearer",
        user_id=user.id,
        email=user.email,
        full_name=user.full_name
    )

@router.post("/register", response_model=Token)
def register(user_in: UserRegister, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == user_in.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="An account with this email already exists.")

    new_user = User(
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        full_name=user_in.full_name or user_in.email.split("@")[0]
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    token = create_access_token({"sub": str(new_user.id)})
    return Token(
        access_token=token,
        token_type="bearer",
        user_id=new_user.id,
        email=new_user.email,
        full_name=new_user.full_name
    )

@router.post("/login", response_model=Token)
def login(login_in: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == login_in.email).first()
    
    # Auto-seed default user if logging in with default credentials
    if not user and login_in.email == DEFAULT_EMAIL and login_in.password == DEFAULT_PASSWORD:
        user = User(
            email=DEFAULT_EMAIL,
            full_name=DEFAULT_NAME,
            hashed_password=get_password_hash(DEFAULT_PASSWORD)
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    if not user or not user.hashed_password or not verify_password(login_in.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password."
        )

    token = create_access_token({"sub": str(user.id)})
    return Token(
        access_token=token,
        token_type="bearer",
        user_id=user.id,
        email=user.email,
        full_name=user.full_name
    )

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user
