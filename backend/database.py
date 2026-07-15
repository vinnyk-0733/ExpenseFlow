from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

db_url = "postgresql://postgres:vinayakrm073%40@localhost:5432/expenseflow"
engine = create_engine(db_url)
session = sessionmaker(bind=engine,autocommit=False,autoflush=False)