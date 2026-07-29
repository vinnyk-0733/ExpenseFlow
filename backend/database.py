from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
import os

load_dotenv()

db_url = os.getenv('DATABASE_URL','postgresql://postgres:vinayakrm073%40@localhost:5432/expenseflow')
engine = create_engine(db_url)
session = sessionmaker(bind=engine,autocommit=False,autoflush=False)