import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from config import settings

BACKEND_DIR = os.path.dirname(os.path.dirname(__file__))
DB_PATH = os.path.abspath(os.path.join(BACKEND_DIR, settings.database_path))
DATABASE_URL = f"sqlite+aiosqlite:///{DB_PATH}"

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


async def init_db():
    schema_path = os.path.join(os.path.dirname(__file__), "schema.sql")
    with open(schema_path) as f:
        sql = f.read()

    import aiosqlite
    async with aiosqlite.connect(DB_PATH) as conn:
        await conn.executescript(sql)
        await conn.commit()
