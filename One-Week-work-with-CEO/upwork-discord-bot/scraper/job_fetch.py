#!/usr/bin/env python3
"""
Standalone script to fetch Upwork jobs
Usage: python job_fetch.py --query "web scraping" --limit 10 --filter-only
"""
import sys
import json
import asyncio
import argparse
from pathlib import Path
import io

# Force UTF-8 encoding for stdout/stderr on Windows
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# Redirect all print statements to stderr so only JSON goes to stdout
original_stdout = sys.stdout
sys.stdout = sys.stderr

# Add parent directory to path to import upwork_scraper
sys.path.insert(0, str(Path(__file__).parent.parent))

from scraper.upwork_scraper import UpworkScraper


def fetch_jobs_sync(query: str, limit: int = 10):
    """Fetch jobs from Upwork (synchronous wrapper)"""
    scraper = UpworkScraper()
    
    try:
        # Fetch jobs using the scraper with only the keyword filter
        # The scraper's fetch_jobs now handles the async execution internally
        jobs = scraper.fetch_jobs(query=query, limit=limit, delay=False, filters=None)
        
        # Filter to only live/recent jobs (posted within last 24 hours ideally)
        # This is handled by the scraper itself
        
        return jobs
    except Exception as e:
        print(f"Error fetching jobs: {e}", file=sys.stderr)
        return []


def main():
    parser = argparse.ArgumentParser(description='Fetch Upwork jobs')
    parser.add_argument('--query', type=str, required=True, help='Search keyword or URL')
    parser.add_argument('--limit', type=int, default=10, help='Maximum number of jobs to fetch')
    parser.add_argument('--filter-only', action='store_true', help='Only filter by keyword, no other filters')
    
    args = parser.parse_args()
    
    try:
        # Run fetch (now synchronous since scraper.fetch_jobs handles async internally)
        jobs = fetch_jobs_sync(args.query, args.limit)
        
        # Restore stdout and output JSON
        sys.stdout = original_stdout
        print(json.dumps(jobs, indent=2, ensure_ascii=False))
        sys.exit(0)  # Explicit success exit
        
    except Exception as e:
        print(f"Fatal error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
