import os
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

load_dotenv()

raw_db_url = os.getenv('DATABASE_URL', 'postgresql://postgres:vinayakrm073%40@localhost:5432/expenseflow')

# Convert postgresql:// or postgresql+psycopg2:// to postgresql+asyncpg://
if raw_db_url.startswith('postgresql://'):
    db_url = raw_db_url.replace('postgresql://', 'postgresql+asyncpg://', 1)
elif raw_db_url.startswith('postgresql+psycopg2://'):
    db_url = raw_db_url.replace('postgresql+psycopg2://', 'postgresql+asyncpg://', 1)
else:
    db_url = raw_db_url

engine = create_async_engine(
    db_url,
    pool_size=20,
    max_overflow=10,
    pool_pre_ping=True,
    pool_recycle=3600
)

async_session = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)