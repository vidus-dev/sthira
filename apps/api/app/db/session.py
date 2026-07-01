from collections.abc import AsyncGenerator

from app.config import get_settings
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

settings = get_settings()
engine = create_async_engine(
    settings.database_url,
    echo=False,
    pool_pre_ping=True,
)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session


async def init_db() -> None:
    """Verify database connectivity. Run ``alembic upgrade head`` separately before deploy."""
    async with engine.connect() as conn:
        await conn.execute(text("SELECT 1"))


async def close_engine() -> None:
    await engine.dispose()
