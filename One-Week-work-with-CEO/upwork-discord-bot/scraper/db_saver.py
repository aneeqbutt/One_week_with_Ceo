# scraper/db_saver.py
"""
Handles saving jobs to the database for UpworkScraper.
"""

def save_jobs_to_db(jobs_data):
    """Save jobs to database with corrected field mapping and proper data types"""
    from db.database import SessionLocal
    from db.models import Job
    try:
        session = SessionLocal()
        saved_count = 0
        for job in jobs_data:
            try:
                job_fields = {
                    "job_id": job["id"],
                    "title": job["title"],
                    "budget": job["budget_numeric"],
                    "client": job["client"]
                }
                try:
                    from sqlalchemy import inspect
                    mapper = inspect(Job)
                    column_names = [column.name for column in mapper.columns]
                    if 'description' in column_names:
                        job_fields["description"] = job["description"]
                    else:
                        print(f"Job model doesn't have 'description' field. Available fields: {column_names}")
                except Exception as e:
                    print(f"Could not check Job model fields: {e}")
                db_job = Job(**job_fields)
                session.merge(db_job)
                saved_count += 1
            except Exception as e:
                print(f"Error saving job to DB: {e}")
                print(f"Job data: {job.get('id', 'Unknown')} - {job.get('title', 'No title')}")
                print(f"Available Job model fields: {list(Job.__table__.columns.keys())}")
                continue
        session.commit()
        session.close()
        print(f"Saved {saved_count} jobs to database")
    except Exception as e:
        print(f"Database error: {e}")
        print(f"Job model columns: {list(Job.__table__.columns.keys()) if hasattr(Job, '__table__') else 'Unknown'}")
        if 'session' in locals():
            session.rollback()
            session.close()
