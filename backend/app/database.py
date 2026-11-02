import os
import socket
import logging
from pathlib import Path
from urllib.parse import urlparse
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import settings

logger = logging.getLogger("opic_database")

def is_tcp_reachable(host: str, port: int = 5432, timeout: float = 3.0) -> bool:
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
            if host and is_tcp_reachable(host, port, timeout=3.0):
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
                connect_args={"connect_timeout": 5}
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


# Columns added after the first release. create_all() never alters existing tables and the project has
# no migration tool, so missing columns are added here (idempotent, works on SQLite and PostgreSQL).
ADDED_COLUMNS = {
    "questions": {"category": "VARCHAR(50)"},
    "answer_versions": {"audio_path": "VARCHAR(255)", "duration_seconds": "FLOAT", "speech_metrics": "JSON"},
    "evaluations": {"tense_timeline": "JSON", "tense_distribution": "JSON", "vietlish_warnings": "JSON", "vocab_upgrades": "JSON"},
    "test_sessions": {"dev_mock": "BOOLEAN DEFAULT FALSE"},
    "daily_workouts": {"source_question_id": "INTEGER"},
}


SESSION_DATA_TABLES = [
    "feedback_items",
    "evaluations",
    "answer_versions",
    "answers",
    "model_answers",
    "questions",
    "session_reports",
    "llm_usage_logs",
    "daily_workouts",
    "test_sessions",
]


def reset_table_sequences(conn, tables=SESSION_DATA_TABLES):
    """Resets auto-increment ID sequences back to 1 for the given tables (PostgreSQL & SQLite)."""
    dialect = conn.dialect.name
    if dialect == "postgresql":
        for tbl in tables:
            try:
                conn.execute(
                    text(f"SELECT setval(pg_get_serial_sequence('{tbl}', 'id'), 1, false)")
                )
            except Exception:
                pass
    elif dialect == "sqlite":
        try:
            has_seq = conn.execute(
                text("SELECT name FROM sqlite_master WHERE type='table' AND name='sqlite_sequence'")
            ).fetchone()
            if has_seq:
                for tbl in tables:
                    conn.execute(text("DELETE FROM sqlite_sequence WHERE name = :tbl"), {"tbl": tbl})
        except Exception:
            pass


def wipe_all_question_set_data(db_engine=None):
    """
    Deletes all question sets, sessions, answers, evaluations, and reports while keeping
    `users` (login accounts) and `user_vocabularies` intact, and resets ID sequences to 1.
    """
    from sqlalchemy import inspect
    db_engine = db_engine or engine
    inspector = inspect(db_engine)
    existing_tables = set(inspector.get_table_names())

    with db_engine.begin() as conn:
        for tbl in SESSION_DATA_TABLES:
            if tbl in existing_tables:
                conn.execute(text(f"DELETE FROM {tbl}"))
        if "user_vocabularies" in existing_tables:
            conn.execute(text("UPDATE user_vocabularies SET source_question_id = NULL"))
        reset_table_sequences(conn, [t for t in SESSION_DATA_TABLES if t in existing_tables])

    # Remove uploaded recordings and PDF reports on disk
    for folder in (settings.AUDIO_UPLOAD_DIR, settings.REPORTS_DIR):
        if os.path.isdir(folder):
            for fname in os.listdir(folder):
                fpath = os.path.join(folder, fname)
                if os.path.isfile(fpath):
                    try:
                        os.remove(fpath)
                    except OSError:
                        pass


def ensure_schema(db_engine=None):
    from sqlalchemy import inspect
    db_engine = db_engine or engine
    inspector = inspect(db_engine)
    existing_tables = set(inspector.get_table_names())
    with db_engine.begin() as conn:
        for table, columns in ADDED_COLUMNS.items():
            if table not in existing_tables:
                continue
            present = {c["name"] for c in inspector.get_columns(table)}
            for name, ddl in columns.items():
                if name not in present:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}"))
                    logger.info(f"Added column {table}.{name}")

        # One-time migration: wipe legacy question set data while preserving users (login accounts)
        if "PYTEST_CURRENT_TEST" not in os.environ and str(db_engine.url) != "sqlite:///:memory:":
            conn.execute(
                text("CREATE TABLE IF NOT EXISTS _schema_migrations (migration_key VARCHAR(100) PRIMARY KEY)")
            )
            migration_key = "wipe_question_sets_20261102"
            done = conn.execute(
                text("SELECT 1 FROM _schema_migrations WHERE migration_key = :k"),
                {"k": migration_key},
            ).fetchone()
            if not done:
                for tbl in SESSION_DATA_TABLES:
                    if tbl in existing_tables:
                        conn.execute(text(f"DELETE FROM {tbl}"))
                if "user_vocabularies" in existing_tables:
                    conn.execute(text("UPDATE user_vocabularies SET source_question_id = NULL"))
                reset_table_sequences(conn, [t for t in SESSION_DATA_TABLES if t in existing_tables])
                conn.execute(
                    text("INSERT INTO _schema_migrations (migration_key) VALUES (:k)"),
                    {"k": migration_key},
                )
                logger.info("Cleared all question set / session data and reset IDs to 1 (users preserved).")
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    """Dependency that yields an active database session and closes it cleanly."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

