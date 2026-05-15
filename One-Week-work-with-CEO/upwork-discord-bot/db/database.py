from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from db.models import Base
from config import POSTGRES_URL


engine = create_engine(POSTGRES_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Ensure all tables/columns are created (including new gemini_decision)
def ensure_schema():
    Base.metadata.create_all(bind=engine)

ensure_schema()

def init_db():
    Base.metadata.create_all(bind=engine)
