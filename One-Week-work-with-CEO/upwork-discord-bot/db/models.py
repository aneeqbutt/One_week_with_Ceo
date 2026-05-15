from sqlalchemy import Column, Integer, String, Text, Float, DateTime
from sqlalchemy.ext.declarative import declarative_base
import datetime

Base = declarative_base()


class Job(Base):
    __tablename__ = "jobs"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    job_id = Column(String, unique=True, index=True)
    title = Column(String)
    description = Column(Text)
    budget = Column(Float)
    skills = Column(Text)
    client = Column(String)
    posted_at = Column(DateTime, default=datetime.datetime.utcnow)

# New model for BHW threads
class BHWThread(Base):
    __tablename__ = "bhw_threads"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    link = Column(String, unique=True, index=True)
    title = Column(String)
    author = Column(String)
    posted = Column(String)
    full_description = Column(Text)
    budget = Column(String)
    requirements = Column(Text)
    deadline = Column(String)
    contact_info = Column(String)
    tags = Column(Text)
    post_content = Column(Text)
    replies_count = Column(Integer)
    views_count = Column(Integer)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    gemini_decision = Column(String)
