from datetime import datetime
from typing import List
from fastapi import FastAPI, HTTPException, status, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from database import engine
import database_model
import models
import redis
import json
from auth_utils import get_db,create_access_token, create_refresh_token, hash_pin, verify_pin, verify_refresh_token, get_current_user

# Auto-create tables
try:
    database_model.Base.metadata.create_all(bind=engine)
    print("Database tables initialized successfully.")
except Exception as e:
    print(f"Skipping database table initialization: {e}")

app = FastAPI(
    title="ExpenseFlow API",
    description="REST API backend for ExpenseFlow tracker with JWT Auth & Redis Caching.",
    version="1.0.0",
)

# Enable CORS so the frontend can connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Preset gradient colors for day cards
GRADIENTS = [
    "linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(29, 78, 216, 0.04) 100%)",   # Blue
    "linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(4, 120, 87, 0.04) 100%)",    # Emerald
    "linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(109, 40, 217, 0.04) 100%)",  # Purple
    "linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(180, 83, 9, 0.04) 100%)",    # Amber
    "linear-gradient(135deg, rgba(236, 72, 153, 0.1) 0%, rgba(190, 24, 93, 0.04) 100%)",   # Pink
    "linear-gradient(135deg, rgba(20, 184, 166, 0.1) 0%, rgba(15, 118, 110, 0.04) 100%)"   # Teal
]

# Initialize Redis client
redis_client = None
try:
    client = redis.Redis(
        host="127.0.0.1", 
        port=6379, 
        db=0, 
        decode_responses=True,
        socket_timeout=1.0,
        socket_connect_timeout=1.0,
        retry_on_timeout=False,
        retry=None
    )
    client.ping()
    redis_client = client
    print("Redis server connected successfully. Caching is enabled.")
except Exception as e:
    print(f"Redis server is offline: {e}. Caching is disabled.")
    redis_client = None

def invalidate_user_cache(user_id: int):
    if redis_client:
        try:
            redis_client.delete(f"user_{user_id}_days")
        except Exception as e:
            print(f"Redis cache invalidation error: {e}")

def get_formatted_today() -> str:
    now = datetime.now()
    return f"{now.strftime('%B')} {now.day}, {now.year}"


# ==========================================
# AUTH ENDPOINTS
# ==========================================

@app.post("/api/auth/signup", response_model=models.TokenResponse, status_code=status.HTTP_201_CREATED)
def signup(payload: models.UserSignUp, db: Session = Depends(get_db)):
    """Registers a new user and returns access + refresh tokens."""
    existing_user = db.query(database_model.User).filter(
        database_model.User.phone_number == payload.phone_number
    ).first()
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Phone number is already registered."
        )

    hashed_pin = hash_pin(payload.pin)
    new_user = database_model.User(
        name=payload.name,
        phone_number=payload.phone_number,
        pin_hash=hashed_pin
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    access_token = create_access_token(user_id=new_user.id)
    refresh_token = create_refresh_token(user_id=new_user.id)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user_name": new_user.name
    }


@app.post("/api/auth/signin", response_model=models.TokenResponse)
def signin(payload: models.UserSignIn, db: Session = Depends(get_db)):
    """Validates phone + PIN and issues access + refresh tokens."""
    user = db.query(database_model.User).filter(
        database_model.User.phone_number == payload.phone_number
    ).first()

    if not user or not verify_pin(payload.pin, user.pin_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid phone number or PIN."
        )

    access_token = create_access_token(user_id=user.id)
    refresh_token = create_refresh_token(user_id=user.id)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user_name": user.name
    }


@app.post("/api/auth/refresh")
def refresh_access_token(payload: models.RefreshTokenRequest, db: Session = Depends(get_db)):
    """Generates a new access token when old access token expires."""
    user_id = verify_refresh_token(payload.refresh_token)
    user = db.query(database_model.User).filter(database_model.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    new_access_token = create_access_token(user_id=user.id)
    return {
        "access_token": new_access_token,
        "token_type": "bearer"
    }


@app.get("/api/auth/me", response_model=models.UserResponse)
def get_me(current_user: database_model.User = Depends(get_current_user)):
    """Returns details of the currently authenticated user."""
    return current_user


# ==========================================
# DAY CARDS ENDPOINTS (User-Isolated)
# ==========================================

@app.get("/api/days", response_model=List[models.Day])
def get_days(
    db: Session = Depends(get_db), 
    current_user: database_model.User = Depends(get_current_user)
):
    """Retrieve all Day cards belonging to the logged-in user."""
    cache_key = f"user_{current_user.id}_days"
    if redis_client:
        try:
            cached = redis_client.get(cache_key)
            if cached:
                return json.loads(cached)
        except Exception as e:
            print(f"Redis cache fetch error: {e}")

    days = db.query(database_model.Day).filter(
        database_model.Day.user_id == current_user.id
    ).order_by(database_model.Day.day.asc()).all()
    
    if redis_client:
        try:
            days_data = [models.Day.model_validate(d).model_dump() for d in days]
            redis_client.setex(cache_key, 3600, json.dumps(days_data, default=str))
        except Exception as e:
            print(f"Redis cache store error: {e}")
            
    return days


@app.post("/api/days", response_model=models.Day, status_code=status.HTTP_201_CREATED)
def create_day(
    db: Session = Depends(get_db),
    current_user: database_model.User = Depends(get_current_user)
):
    """Create a new Day card for the authenticated user."""
    max_day = db.query(func.max(database_model.Day.day)).filter(
        database_model.Day.user_id == current_user.id
    ).scalar() or 0
    
    next_day = max_day + 1
    date_str = get_formatted_today()
    color_index = (next_day - 1) % len(GRADIENTS)
    color = GRADIENTS[color_index]

    db_day = database_model.Day(
        user_id=current_user.id,
        day=next_day,
        date=date_str,
        color=color
    )
    db.add(db_day)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Day card already exists for this date")
    db.refresh(db_day)
    
    invalidate_user_cache(current_user.id)
    return db_day


@app.delete("/api/days/{day_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_day(
    day_id: int, 
    db: Session = Depends(get_db),
    current_user: database_model.User = Depends(get_current_user)
):
    """Delete a day card by ID for the logged-in user."""
    db_day = db.query(database_model.Day).filter(
        database_model.Day.id == day_id,
        database_model.Day.user_id == current_user.id
    ).first()

    if not db_day:
        raise HTTPException(status_code=404, detail="Day card not found.")
    
    db.delete(db_day)
    db.commit()
    invalidate_user_cache(current_user.id)
    return


# ==========================================
# EXPENSE ENDPOINTS (User-Isolated)
# ==========================================

@app.post("/api/days/{day_id}/expenses", response_model=models.Expense, status_code=status.HTTP_201_CREATED)
def add_expense(
    day_id: int, 
    expense_payload: models.ExpenseCreate, 
    db: Session = Depends(get_db),
    current_user: database_model.User = Depends(get_current_user)
):
    """Add a new expense item to a day card belonging to the user."""
    db_day = db.query(database_model.Day).filter(
        database_model.Day.id == day_id,
        database_model.Day.user_id == current_user.id
    ).first()

    if not db_day:
        raise HTTPException(status_code=404, detail="Day card not found.")
    
    db_expense = database_model.Expense(
        day_id=day_id,
        category=expense_payload.category,
        description=expense_payload.description,
        amount=expense_payload.amount
    )
    db.add(db_expense)
    db.commit()
    db.refresh(db_expense)
    invalidate_user_cache(current_user.id)
    return db_expense


@app.put("/api/days/{day_id}/expenses/{expense_id}", response_model=models.Expense)
def edit_expense(
    day_id: int, 
    expense_id: int, 
    expense_payload: models.ExpenseCreate, 
    db: Session = Depends(get_db),
    current_user: database_model.User = Depends(get_current_user)
):
    """Update an individual expense item in a day card."""
    db_day = db.query(database_model.Day).filter(
        database_model.Day.id == day_id,
        database_model.Day.user_id == current_user.id
    ).first()
    if not db_day:
        raise HTTPException(status_code=404, detail="Day card not found.")

    db_expense = db.query(database_model.Expense).filter(
        database_model.Expense.id == expense_id,
        database_model.Expense.day_id == day_id
    ).first()

    if not db_expense:
        raise HTTPException(status_code=404, detail="Expense item not found.")

    db_expense.category = expense_payload.category
    db_expense.description = expense_payload.description
    db_expense.amount = expense_payload.amount
    db.commit()
    db.refresh(db_expense)
    invalidate_user_cache(current_user.id)
    return db_expense


@app.delete("/api/days/{day_id}/expenses/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_expense(
    day_id: int, 
    expense_id: int, 
    db: Session = Depends(get_db),
    current_user: database_model.User = Depends(get_current_user)
):
    """Delete an individual expense item from a day card."""
    db_day = db.query(database_model.Day).filter(
        database_model.Day.id == day_id,
        database_model.Day.user_id == current_user.id
    ).first()
    if not db_day:
        raise HTTPException(status_code=404, detail="Day card not found.")

    db_expense = db.query(database_model.Expense).filter(
        database_model.Expense.id == expense_id,
        database_model.Expense.day_id == day_id
    ).first()

    if not db_expense:
        raise HTTPException(status_code=404, detail="Expense item not found.")

    db.delete(db_expense)
    db.commit()
    invalidate_user_cache(current_user.id)
    return
