from datetime import datetime
from typing import List
from fastapi import FastAPI, HTTPException, status, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func
from sqlalchemy.orm import Session
from database import session, engine
import database_model
import models
import redis
import json



try:
    database_model.Base.metadata.create_all(bind=engine)
    print("Database tables initialized successfully.")
except Exception as e:
    print(f"Skipping database table initialization: {e}")

app = FastAPI(
    title="ExpenseFlow API (Mocked Backend)",
    description="Mocked REST API backend for ExpenseFlow tracker. Operates completely in-memory.",
    version="1.0.0",
)

# Enable CORS so the frontend can connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins for development
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods (GET, POST, DELETE, etc.)
    allow_headers=["*"],  # Allows all headers
)

# Preset gradient colors for day cards (same as frontend)
GRADIENTS = [
    "linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(29, 78, 216, 0.04) 100%)",   # Blue
    "linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(4, 120, 87, 0.04) 100%)",    # Emerald
    "linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(109, 40, 217, 0.04) 100%)",  # Purple
    "linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(180, 83, 9, 0.04) 100%)",    # Amber
    "linear-gradient(135deg, rgba(236, 72, 153, 0.1) 0%, rgba(190, 24, 93, 0.04) 100%)",   # Pink
    "linear-gradient(135deg, rgba(20, 184, 166, 0.1) 0%, rgba(15, 118, 110, 0.04) 100%)"   # Teal
]

# Initial in-memory mock database populated with default days matching frontend
days_db: List[dict] = [
                # {
                #     "Day": 1,
                #     "date": "July 8, 2026",
                #     "color": "linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(29, 78, 216, 0.04) 100%)",
                #     "expenses": [
                #         {"category": "Food", "description": "Lunch at Pizza Hut", "amount": 25.0},
                #         {"category": "Transport", "description": "Uber to office", "amount": 18.0},
                #         {"category": "Shopping", "description": "Mechanical Keyboard", "amount": 75.0},
                #     ]
                # },
                # {
                #     "Day": 2,
                #     "date": "July 9, 2026",
                #     "color": "linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(4, 120, 87, 0.04) 100%)",
                #     "expenses": [
                #         {"category": "Utilities", "description": "High-speed Internet Bill", "amount": 80.0},
                #         {"category": "Food", "description": "Dinner & Drinks", "amount": 45.0},
                #     ]
                # }
            ]

# Ensure all in-memory mock items have required Pydantic fields populated
for index, day in enumerate(days_db):
    if "id" not in day:
        day["id"] = f"day-{index + 1}"
    if "created_at" not in day:
        day["created_at"] = datetime.now()
    for exp_index, exp in enumerate(day.get("expenses", [])):
        if "id" not in exp:
            exp["id"] = f"exp-{index + 1}-{exp_index + 1}"
        if "day_id" not in exp:
            exp["day_id"] = day["id"]


def get_db():
    db = session()
    try:
        yield db
    finally:
        db.close()

def init_db():
    db = session()
    try:
        count = db.query(database_model.Day).count()
        if count == 0:
            for day in days_db:
                # Copy to avoid mutating the in-memory days_db
                day_copy = day.copy()
                expense_data = day_copy.pop("expenses", [])
                
                # Exclude created_at and id from the DB constructor since DB auto-generates created_at
                day_copy.pop("id", None)
                day_copy.pop("created_at", None)
                
    
                new_day = database_model.Day(**day_copy)
                db.add(new_day)
                db.flush()
                
                for expense in expense_data:
                    expense_copy = expense.copy()
                    expense_copy.pop("id", None)
                    expense_copy.pop("day_id", None)
                    new_expense = database_model.Expense(
                        day_id=new_day.id,
                        **expense_copy
                    )
                    db.add(new_expense)
            db.commit()
            print("Database successfully seeded with default days.")
    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
    finally:
        db.close()

try:
    init_db()
except Exception as e:
    print(f"Error initializing/seeding database: {e}")
    
    
# Initialize Redis client and ping on startup to determine if Redis is online
redis_client = None
try:
    client = redis.Redis(
        host="127.0.0.1", 
        port=6379, 
        db=0, 
        decode_responses=True,
        socket_timeout=1.0,           # 1 second timeout on commands
        socket_connect_timeout=1.0,   # 1 second timeout on connection attempts
        retry_on_timeout=False,       # Do not retry on timeouts
        retry=None                    # Disable retry attempts to fail fast
    )
    client.ping()                     # Active check to confirm connection
    redis_client = client
    print("Redis server connected successfully. Caching is enabled.")
except Exception as e:
    print(f"Redis server is offline: {e}. Caching is disabled (falling back to direct DB access).")
    redis_client = None

# Helper to safely invalidate cache on day/expense modifications
def invalidate_cache():
    if redis_client:
        try:
            redis_client.delete("all_days")
        except Exception as e:
            print(f"Redis cache invalidation error: {e}")
    

# Helper function to format dates to match frontend format (e.g. "July 13, 2026")
def get_formatted_today() -> str:
    now = datetime.now()
    # Format month name and year
    month_name = now.strftime("%B")
    year = now.year
    day = now.day
    return f"{month_name} {day}, {year}"

# --- ENDPOINTS ---

@app.get("/api/days", response_model=List[models.Day])
def get_days(db: Session = Depends(get_db)):
    """Retrieve all Day cards and their associated expense history from the database."""
    if redis_client:
        try:
            cache_day = redis_client.get("all_days")
            if cache_day:
                return json.loads(cache_day)
        except Exception as e:
            print(f"Redis cache fetch error: {e}")

    days = db.query(database_model.Day).all()
    
    if redis_client:
        try:
            days_data = [models.Day.from_orm(d).dict() for d in days]
            redis_client.setex("all_days", 3600, json.dumps(days_data, default=str))
        except Exception as e:
            print(f"Redis cache store error: {e}")
            
    return days

@app.post("/api/days", response_model=models.Day, status_code=status.HTTP_201_CREATED)
def create_day(db: Session = Depends(get_db)):
    """
    Create a new Day card.
    The ID is auto-incremented by the database, and the Day number is calculated
    based on the maximum Day integer in the database.
    """
    max_day = db.query(func.max(database_model.Day.Day)).scalar() or 0
    next_day = max_day + 1
            
    # Setup auto-generated parameters
    Day = next_day
    date = get_formatted_today()
    
    # Select color dynamically from the gradients array based on the day number
    color_index = (next_day - 1) % len(GRADIENTS)
    color = GRADIENTS[color_index]

    # Create database record (let database handle ID auto-increment)
    db_day = database_model.Day(
        Day=Day,
        date=date,
        color=color
    )
    db.add(db_day)
    db.commit()
    db.refresh(db_day)
    
    invalidate_cache()
    return db_day

@app.delete("/api/days/{day_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_day(day_id: int, db: Session = Depends(get_db)):
    """Delete a day card and all its expenses by ID from the database."""
    db_day = db.query(database_model.Day).filter(database_model.Day.id == day_id).first()
    if not db_day:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Day card with ID '{day_id}' not found."
        )
    db.delete(db_day)
    db.commit()
    invalidate_cache()
    return


# In main.py
@app.post("/api/days/{day_id}/expenses", response_model=models.Expense, status_code=status.HTTP_201_CREATED)
def add_expense(day_id: int, expense_payload: models.ExpenseCreate, db: Session = Depends(get_db)):
    db_day = db.query(database_model.Day).filter(database_model.Day.id == day_id).first()
    if not db_day:
        raise HTTPException(status_code=404, detail="Day not found")
    
    # No max_id queries or next_id calculation needed!
    db_expense = database_model.Expense(
        day_id=day_id,
        category=expense_payload.category,
        description=expense_payload.description,
        amount=expense_payload.amount
    )
    db.add(db_expense)
    db.commit()
    db.refresh(db_expense)
    invalidate_cache()
    return db_expense


@app.put("/api/days/{day_id}/expenses/{expense_id}", response_model=models.Expense)
def edit_expense(day_id: int, expense_id: int, expense_payload: models.ExpenseCreate, db: Session = Depends(get_db)):
    """Update an individual expense item in a specific day card inside the database."""
    db_expense = db.query(database_model.Expense).filter(
        database_model.Expense.id == expense_id,
        database_model.Expense.day_id == day_id
    ).first()

    if not db_expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Expense item with ID '{expense_id}' not found in Day card '{day_id}'."
        )

    db_expense.category = expense_payload.category
    db_expense.description = expense_payload.description
    db_expense.amount = expense_payload.amount
    db.commit()
    db.refresh(db_expense)
    invalidate_cache()
    return db_expense


@app.delete("/api/days/{day_id}/expenses/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_expense(day_id: int, expense_id: int, db: Session = Depends(get_db)):
    """Delete an individual expense item from a day card in the database."""
    db_expense = db.query(database_model.Expense).filter(
        database_model.Expense.id == expense_id,
        database_model.Expense.day_id == day_id
    ).first()

    if not db_expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Expense item with ID '{expense_id}' not found in Day card '{day_id}'."
        )
    db.delete(db_expense)
    db.commit()
    invalidate_cache()
    return
