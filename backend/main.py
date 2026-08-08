import logging
import uuid
import time
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import FastAPI, HTTPException, status, Depends, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select, text
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from database import engine
import database_model
import models
import redis
from redis.backoff import ExponentialBackoff
from redis.retry import Retry
import json
from auth_utils import get_db,create_access_token, create_refresh_token, hash_pin, verify_pin, verify_refresh_token, get_current_user

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from prometheus_fastapi_instrumentator import Instrumentator

# --- Structured Logger Setup ---
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] [%(levelname)s] [%(name)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger("expenseflow")

# Rate limit config - use Redis if available, fallback to in-memory for dev
import os
REDIS_URL = os.getenv('REDIS_URL', 'redis://127.0.0.1:6379')
try:
    limiter = Limiter(
        key_func=get_remote_address,
        storage_uri=REDIS_URL
    )
except Exception:
    # Fallback to in-memory storage if Redis unavailable
    limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="ExpenseFlow API",
    description="REST API backend for ExpenseFlow tracker with JWT Auth & Redis Caching.",
    version="1.0.0",
)

# --- Expose Prometheus Metrics (/metrics) ---
Instrumentator().instrument(app).expose(app, endpoint="/metrics")

# --- Request ID & Latency Logging Middleware ---
@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    request_id = str(uuid.uuid4())
    start_time = time.time()
    
    response = await call_next(request)
    
    process_time_ms = round((time.time() - start_time) * 1000, 2)
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Process-Time-MS"] = str(process_time_ms)
    
    logger.info(f"request_id={request_id} method={request.method} path={request.url.path} status={response.status_code} duration_ms={process_time_ms}")
    return response

@app.on_event("startup")
async def init_tables():
    logger.info("Database schema management active via Alembic versioned migrations.")

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)
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

# Initialize Redis client with Connection Pooling, Auto-Retry & Exponential Backoff
redis_client = None
try:
    redis_client = redis.Redis.from_url(
        "redis://127.0.0.1:6379/0",
        max_connections=50,
        decode_responses=True,
        socket_timeout=1.0,
        socket_connect_timeout=1.0,
        retry_on_timeout=True,
        retry=Retry(ExponentialBackoff(), 3)
    )
    redis_client.ping()
    logger.info("Redis server connected successfully with connection pooling & retry strategy.")
except Exception as e:
    logger.warning(f"Redis server is offline: {e}. Caching is disabled.")
    redis_client = None

def invalidate_user_cache(user_id: int):
    if redis_client:
        try:
            redis_client.delete(f"user_{user_id}_days")
        except Exception as e:
            logger.error(f"Redis cache invalidation error: {e}")

def get_formatted_today() -> str:
    now = datetime.now()
    return f"{now.strftime('%B')} {now.day}, {now.year}"


# ==========================================
# SYSTEM CONFIG & HEALTH PROBES
# ==========================================

@app.get("/api/v1/config/gradients", status_code=status.HTTP_200_OK)
async def get_gradient_config():
    """Returns master list of card theme gradients (Single Source of Truth)."""
    return {"gradients": GRADIENTS}


@app.get("/api/v1/health", status_code=status.HTTP_200_OK)
async def health_check():
    """Liveness probe: Checks if the FastAPI application process is alive."""
    return {
        "status": "healthy",
        "service": "ExpenseFlow API v1",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@app.get("/api/v1/ready", status_code=status.HTTP_200_OK)
async def readiness_check(db: AsyncSession = Depends(get_db)):
    """Readiness probe: Checks PostgreSQL DB and Redis connectivity."""
    checks = {
        "database": "down",
        "redis": "down"
    }
    is_ready = True

    # 1. Test PostgreSQL Connection
    try:
        await db.execute(text("SELECT 1"))
        checks["database"] = "up"
    except Exception as e:
        is_ready = False
        checks["database_error"] = str(e)

    # 2. Test Redis Connection
    if redis_client:
        try:
            redis_client.ping()
            checks["redis"] = "up"
        except Exception as e:
            checks["redis"] = "degraded"
            checks["redis_error"] = str(e)
    else:
        checks["redis"] = "disabled"

    if not is_ready:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"status": "unready", "checks": checks}
        )

    return {"status": "ready", "checks": checks}


# ==========================================
# AUTH ENDPOINTS (v1)
# ==========================================

@app.post("/api/v1/auth/signup", response_model=models.TokenResponse, status_code=status.HTTP_201_CREATED) 
@limiter.limit("5/minute")
async def signup(request:Request,payload: models.UserSignUp, db: AsyncSession = Depends(get_db)):
    """Registers a new user and returns access + refresh tokens."""
    result = await db.execute(select(database_model.User).where(database_model.User.phone_number == payload.phone_number))
    existing_user = result.scalars().first()
    
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
    await db.commit()
    await db.refresh(new_user)

    access_token = create_access_token(user_id=new_user.id)
    refresh_token = create_refresh_token(user_id=new_user.id)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user_name": new_user.name
    }


@app.post("/api/v1/auth/signin", response_model=models.TokenResponse)
@limiter.limit("5/minute")
async def signin(request:Request,payload: models.UserSignIn, db: AsyncSession = Depends(get_db)):
    """Validates phone + PIN and issues access + refresh tokens."""
    lockout_key = f"lockout_{payload.phone_number}"
    failed_key = f"failed_attempts_{payload.phone_number}"

    # Check if account is temporarily locked out
    if redis_client and redis_client.get(lockout_key):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Account temporarily locked due to multiple failed PIN attempts. Please try again in 15 minutes."
        )

    result = await db.execute(select(database_model.User).where(database_model.User.phone_number == payload.phone_number))
    user = result.scalars().first()

    if not user or not verify_pin(payload.pin, user.pin_hash):
        if redis_client:
            attempts = redis_client.incr(failed_key)
            redis_client.expire(failed_key, 900)
            if attempts >= 5:
                redis_client.setex(lockout_key, 900, "locked")
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many failed PIN attempts. Account locked for 15 minutes."
                )

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid phone number or PIN."
        )

    # Successful signin -> Clear failed attempts counter
    if redis_client:
        redis_client.delete(failed_key)

    access_token = create_access_token(user_id=user.id)
    refresh_token = create_refresh_token(user_id=user.id)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user_name": user.name
    }


@app.post("/api/v1/auth/refresh")
async def refresh_access_token(payload: models.RefreshTokenRequest, db: AsyncSession = Depends(get_db)):
    """Generates a new access token when old access token expires."""
    user_id = verify_refresh_token(payload.refresh_token)
    result = await db.execute(select(database_model.User).where(database_model.User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    new_access_token = create_access_token(user_id=user.id)
    return {
        "access_token": new_access_token,
        "token_type": "bearer"
    }


@app.get("/api/v1/auth/me", response_model=models.UserResponse)
async def get_me(current_user: database_model.User = Depends(get_current_user)):
    """Returns details of the currently authenticated user."""
    return current_user


# ==========================================
# DAY CARDS ENDPOINTS (v1 - User-Isolated)
# ==========================================

@app.get("/api/v1/days", response_model=models.PaginatedDaysResponse)
async def get_days(
    limit: int = Query(default=20, ge=1, le=100),
    cursor: Optional[int] = Query(default=None),
    db: AsyncSession = Depends(get_db), 
    current_user: database_model.User = Depends(get_current_user)
):
    """Retrieve Day cards belonging to the logged-in user with cursor pagination."""
    cache_key = f"user_{current_user.id}_days_l{limit}_c{cursor}"
    if redis_client:
        try:
            cached = redis_client.get(cache_key)
            if cached:
                return json.loads(cached)
        except Exception as e:
            logger.error(f"Redis cache fetch error: {e}")

    stmt = select(database_model.Day).options(
        selectinload(database_model.Day.expenses)
    ).where(
        database_model.Day.user_id == current_user.id
    )

    if cursor:
        stmt = stmt.where(database_model.Day.id < cursor)

    stmt = stmt.order_by(database_model.Day.day.asc()).limit(limit + 1)
    
    result = await db.execute(stmt)
    fetched_days = result.scalars().all()

    has_more = len(fetched_days) > limit
    items = fetched_days[:limit]
    next_cursor = items[-1].id if (has_more and items) else None

    response_data = {
        "items": [models.Day.model_validate(d).model_dump() for d in items],
        "next_cursor": next_cursor,
        "has_more": has_more
    }
    
    if redis_client:
        try:
            redis_client.setex(cache_key, 3600, json.dumps(response_data, default=str))
        except Exception as e:
            logger.error(f"Redis cache store error: {e}")
            
    return response_data


@app.post("/api/v1/days", response_model=models.Day, status_code=status.HTTP_201_CREATED)
async def create_day(
    db: AsyncSession = Depends(get_db),
    current_user: database_model.User = Depends(get_current_user)
):
    """Create a new Day card for the authenticated user."""
    stmt = select(func.max(database_model.Day.day)).where(
        database_model.Day.user_id == current_user.id
    )
    result = await db.execute(stmt)
    max_day = result.scalar() or 0
    
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
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Day card already exists for this date")

    stmt_fetch = select(database_model.Day).options(
        selectinload(database_model.Day.expenses)
    ).where(database_model.Day.id == db_day.id)
    res = await db.execute(stmt_fetch)
    fetched_day = res.scalars().first()
    
    invalidate_user_cache(current_user.id)
    return fetched_day


@app.delete("/api/v1/days/{day_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_day(
    day_id: int, 
    db: AsyncSession = Depends(get_db),
    current_user: database_model.User = Depends(get_current_user)
):
    """Delete a day card by ID for the logged-in user."""
    result = await db.execute(select(database_model.Day).where(
        database_model.Day.id == day_id,
        database_model.Day.user_id == current_user.id
    ))
    db_day = result.scalars().first()

    if not db_day:
        raise HTTPException(status_code=404, detail="Day card not found.")
    
    await db.delete(db_day)
    await db.commit()
    invalidate_user_cache(current_user.id)
    return


# ==========================================
# EXPENSE ENDPOINTS (v1 - User-Isolated)
# ==========================================

@app.post("/api/v1/days/{day_id}/expenses", response_model=models.Expense, status_code=status.HTTP_201_CREATED)
async def add_expense(
    day_id: int, 
    expense_payload: models.ExpenseCreate, 
    db: AsyncSession = Depends(get_db),
    current_user: database_model.User = Depends(get_current_user)
):
    """Add a new expense item to a day card belonging to the user."""
    result = await db.execute(select(database_model.Day).where(
        database_model.Day.id == day_id,
        database_model.Day.user_id == current_user.id
    ))
    db_day = result.scalars().first()

    if not db_day:
        raise HTTPException(status_code=404, detail="Day card not found.")
    
    db_expense = database_model.Expense(
        day_id=day_id,
        category=expense_payload.category,
        description=expense_payload.description,
        amount=expense_payload.amount
    )
    db.add(db_expense)
    await db.commit()
    await db.refresh(db_expense)
    invalidate_user_cache(current_user.id)
    return db_expense


@app.put("/api/v1/days/{day_id}/expenses/{expense_id}", response_model=models.Expense)
async def edit_expense(
    day_id: int, 
    expense_id: int, 
    expense_payload: models.ExpenseCreate, 
    db: AsyncSession = Depends(get_db),
    current_user: database_model.User = Depends(get_current_user)
):
    """Update an individual expense item in a day card."""
    res_day = await db.execute(select(database_model.Day).where(
        database_model.Day.id == day_id,
        database_model.Day.user_id == current_user.id
    ))
    db_day = res_day.scalars().first()
    if not db_day:
        raise HTTPException(status_code=404, detail="Day card not found.")

    res_exp = await db.execute(select(database_model.Expense).where(
        database_model.Expense.id == expense_id,
        database_model.Expense.day_id == day_id
    ))
    db_expense = res_exp.scalars().first()

    if not db_expense:
        raise HTTPException(status_code=404, detail="Expense item not found.")

    db_expense.category = expense_payload.category
    db_expense.description = expense_payload.description
    db_expense.amount = expense_payload.amount
    await db.commit()
    await db.refresh(db_expense)
    invalidate_user_cache(current_user.id)
    return db_expense


@app.delete("/api/v1/days/{day_id}/expenses/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_expense(
    day_id: int, 
    expense_id: int, 
    db: AsyncSession = Depends(get_db),
    current_user: database_model.User = Depends(get_current_user)
):
    """Delete an individual expense item from a day card."""
    res_day = await db.execute(select(database_model.Day).where(
        database_model.Day.id == day_id,
        database_model.Day.user_id == current_user.id
    ))
    db_day = res_day.scalars().first()
    if not db_day:
        raise HTTPException(status_code=404, detail="Day card not found.")

    res_exp = await db.execute(select(database_model.Expense).where(
        database_model.Expense.id == expense_id,
        database_model.Expense.day_id == day_id
    ))
    db_expense = res_exp.scalars().first()

    if not db_expense:
        raise HTTPException(status_code=404, detail="Expense item not found.")

    await db.delete(db_expense)
    await db.commit()
    invalidate_user_cache(current_user.id)
    return
