from datetime import datetime, timezone
from sqlalchemy.orm import declarative_base
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Numeric, UniqueConstraint
from sqlalchemy.orm import relationship

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    phone_number = Column(String(15), unique=True, nullable=False, index=True)
    pin_hash = Column(String(255), nullable=False)  # Hashed PIN for security
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # 1 user -> many days
    days = relationship("Day", back_populates="user", cascade="all, delete-orphan")


class Day(Base):
    __tablename__ = "days"
    
    id = Column(Integer, autoincrement=True, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    day = Column(Integer, nullable=False)
    date = Column(String, nullable=False, index=True)
    color = Column(String, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    # Ensures a single user cannot create duplicate entries for the same date
    __table_args__ = (UniqueConstraint('user_id', 'date', name='_user_date_uc'),)

    # Relationships
    user = relationship("User", back_populates="days")
    expenses = relationship("Expense", back_populates="day", cascade="all, delete-orphan")


class Expense(Base):
    __tablename__ = "expenses"
     
    id = Column(Integer, autoincrement=True, primary_key=True)
    day_id = Column(Integer, ForeignKey("days.id", ondelete="CASCADE"), nullable=False, index=True)
    category = Column(String(50), nullable=False)
    description = Column(String(255), nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    # Relationship
    day = relationship("Day", back_populates="expenses")