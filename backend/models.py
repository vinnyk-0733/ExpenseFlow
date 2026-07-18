from datetime import datetime
from typing import List, Union
from pydantic import BaseModel

class ExpenseCreate(BaseModel):
    category: str
    description: str
    amount: int

class Expense(BaseModel):
    id: Union[int, str]
    day_id: Union[int, str]
    category: str
    description: str
    amount: int

    class Config:
        orm_mode = True
        from_attributes = True


class Day(BaseModel):
    id: Union[int, str]
    Day: int
    date: str
    color: str
    created_at: datetime
    expenses: List[Expense] = []

    class Config:
        orm_mode = True
        from_attributes = True
