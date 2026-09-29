import os
import socket
import logging
from pathlib import Path
from urllib.parse import urlparse
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import settings

logger = logging.getLogger("opic_database")

def is_tcp_reachable(host: str, port: int = 5432, timeout: float = 1.0) -> bool:
    """Quickly check if the remote host and port are reachable without hanging."""
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        sock.connect((host, port))
        sock.close()
        return True
    except Exception:
        return False

def create_database_engine():
    raw_url = settings.DATABASE_URL
    if raw_url.startswith("postgres://"):
        raw_url = raw_url.replace("postgres://", "postgresql://", 1)

    use_postgres = False
    if not raw_url.startswith("sqlite"):
        try:
            parsed = urlparse(raw_url)
            host = parsed.hostname
            port = parsed.port or 5432
            if host and is_tcp_reachable(host, port, timeout=1.0):
                use_postgres = True
            else:
                logger.warning(
                    f"Remote PostgreSQL port {port} on {host} is unreachable. "
                    "Current network/firewall is blocking outbound port 5432. "
                    "Switching automatically to local SQLite database."
                )
        except Exception as e:
            logger.warning(f"Error checking remote DB host: {e}")

    if use_postgres:
        try:
            logger.info("Connecting to remote PostgreSQL database...")
            pg_engine = create_engine(
                raw_url,
                pool_pre_ping=True,
                pool_size=5,
                max_overflow=10,
                pool_recycle=300,
                connect_args={"connect_timeout": 3}
            )
            with pg_engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            logger.info("Successfully connected to remote PostgreSQL.")
            return pg_engine
        except Exception as exc:
            logger.warning(f"PostgreSQL connection error: {exc}. Falling back to SQLite.")

    # Local SQLite database (reliable fallback for local development)
    current_file = Path(__file__).resolve()
    backend_dir = current_file.parent.parent
    data_dir = backend_dir / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    sqlite_path = (data_dir / "opic_studio.db").as_posix()
    sqlite_url = f"sqlite:///{sqlite_path}"

    logger.info(f"Using local SQLite database: {sqlite_path}")
    return create_engine(
        sqlite_url,
        connect_args={"check_same_thread": False},
        pool_pre_ping=True
    )

engine = create_database_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    """Dependency that yields an active database session and closes it cleanly."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

