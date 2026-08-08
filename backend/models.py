from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, Field

# --- Authentication Schemas ---

class UserSignUp(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    phone_number: str = Field(..., min_length=10, max_length=15)
    pin: str = Field(..., min_length=6, max_length=6, pattern=r"^\d{6}$")

class UserSignIn(BaseModel):
    phone_number: str = Field(..., min_length=10, max_length=15)
    pin: str = Field(..., min_length=6, max_length=6, pattern=r"^\d{6}$")

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user_name: str

class RefreshTokenRequest(BaseModel):
    refresh_token: str

class UserResponse(BaseModel):
    id: int
    name: str
    phone_number: str

    class Config:
        from_attributes = True

# --- Day & Expense Schemas ---

class ExpenseCreate(BaseModel):
    category: str = Field(..., min_length=1, max_length=50)
    description: str = Field(..., min_length=1, max_length=255)
    amount: Decimal = Field(..., gt=0, decimal_places=2, max_digits=10)

class Expense(BaseModel):
    id: int
    day_id: int
    category: str
    description: str
    amount: Decimal
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class Day(BaseModel):
    id: int
    day: int
    date: str
    color: str
    created_at: Optional[datetime] = None
    expenses: List[Expense] = []

    class Config:
        from_attributes = True

class PaginatedDaysResponse(BaseModel):
    items: List[Day]
    next_cursor: Optional[int] = None
    has_more: bool = False