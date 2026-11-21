import os
import tempfile
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.database import Base, get_db
from app.main import app

# Create a temporary file-backed SQLite database with WAL mode to accurately test concurrency
temp_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
temp_db_path = temp_db.name
temp_db.close()

TEST_DATABASE_URL = f"sqlite:///{temp_db_path}"

engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False, "timeout": 30.0}
)

@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.close()

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="session", autouse=True)
def setup_test_env():
    settings.DATABASE_URL = TEST_DATABASE_URL
    settings.ENABLE_FAILURE_SIMULATION = True
    settings.LLM_API_KEYS = "key_1:gemini/gemini-2.0-flash:placeholder_1,key_2:gemini/gemini-2.0-flash:placeholder_2"
    yield
    try:
        if os.path.exists(temp_db_path):
            os.unlink(temp_db_path)
    except Exception:
        pass

@pytest.fixture
def client():
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)
