from datetime import datetime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship

Base = declarative_base()

class Day(Base):
    __tablename__ = "Days"
    
    id = Column(Integer, autoincrement=True, primary_key=True)
    Day = Column(Integer, nullable=False)
    date = Column(String, nullable=False, index=True)
    color = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # ORM Relationship: Allows calling day.expenses to get all nested expenses.
    # cascade="all, delete-orphan" automatically deletes associated expenses when the day card is deleted.
    expenses = relationship("Expense", back_populates="day", cascade="all, delete-orphan")

class Expense(Base):
    __tablename__ = "Expenses"
    
    id = Column(Integer, autoincrement=True, primary_key=True)
    # ondelete="CASCADE" ensures database level foreign key cascade deletion
    day_id = Column(Integer, ForeignKey("Days.id", ondelete="CASCADE"), nullable=False)
    category = Column(String, nullable=False)
    description = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # ORM Relationship back-reference to parent Day model
    day = relationship("Day", back_populates="expenses")