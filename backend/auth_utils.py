from datetime import datetime, timedelta, timezone
import jwt
import bcrypt
from fastapi import HTTPException, status, Depends
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from database import session
import database_model
from dotenv import load_dotenv
import os

load_dotenv()

SECRET_KEY = os.getenv('SECRET_KEY', '8f9e42b6a1d7c3e5f0a8b9c2d1e4f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3')
REFRESH_SECRET_KEY = os.getenv('REFRESH_SECRET_KEY', '3c7a1e9b2f4d6c8a0e2b4f6a8c0d2e4f6a8b0c2d4e6f8a0b2c4d6e8f0a2b4c6e')
ALGORITHM = os.getenv('ALGORITHM', 'HS256')

# Token Expirations (Converted to int)
ACCESS_TOKEN_EXPIRE = int(os.getenv('ACCESS_TOKEN_EXPIRE', 15))
REFRESH_TOKEN_EXPIRE = int(os.getenv('REFRESH_TOKEN_EXPIRE', 7))

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/signin")

# --- PIN Hashing Helpers (Direct bcrypt, bypassing passlib version bug) ---
def hash_pin(pin: str) -> str:
    """Hashes a 4-digit PIN using direct bcrypt."""
    pin_bytes = pin.encode('utf-8')
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pin_bytes, salt).decode('utf-8')

def verify_pin(plain_pin: str, hashed_pin: str) -> bool:
    """Verifies a 4-digit PIN against its stored hash."""
    return bcrypt.checkpw(plain_pin.encode('utf-8'), hashed_pin.encode('utf-8'))

# --- Token Creation Helpers ---
def create_access_token(user_id: int) -> str:
    """Creates a short-lived access JWT token."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE)
    payload = {"sub": str(user_id), "type": "access", "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def create_refresh_token(user_id: int) -> str:
    """Creates a long-lived refresh JWT token."""
    expire = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE)
    payload = {"sub": str(user_id), "type": "refresh", "exp": expire}
    return jwt.encode(payload, REFRESH_SECRET_KEY, algorithm=ALGORITHM)

# --- Token Verification Helpers ---
def verify_refresh_token(token: str) -> int:
    """Validates a refresh token and returns the user_id integer."""
    try:
        payload = jwt.decode(token, REFRESH_SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type.")
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid payload in refresh token.")
        return int(user_id)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh token has expired. Please sign in again.")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid refresh token.")

# --- FastAPI Dependencies ---
def get_db():
    db = session()
    try:
        yield db
    finally:
        db.close()

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> database_model.User:
    """Dependency to extract & validate current user from Authorization header."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate access token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "access":
            raise credentials_exception
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception

    user = db.query(database_model.User).filter(database_model.User.id == int(user_id)).first()
    if user is None:
        raise credentials_exception
    return user