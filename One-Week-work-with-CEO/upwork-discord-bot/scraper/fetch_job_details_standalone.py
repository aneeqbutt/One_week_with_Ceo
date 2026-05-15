#!/usr/bin/env python3
"""
Standalone script to fetch detailed Upwork job information for Node.js integration
Usage: python fetch_job_details_standalone.py --job-id "~012345abc"
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


async def fetch_job_details(job_id: str):
    """Fetch detailed information about a specific job"""
    scraper = UpworkScraper()
    
    try:
        details = await scraper.fetch_job_details(job_id)
        return details
    except Exception as e:
        print(f"Error fetching job details: {e}", file=sys.stderr)
        return None


def main():
    parser = argparse.ArgumentParser(description='Fetch Upwork job details')
    parser.add_argument('--job-id', type=str, required=True, help='Upwork job ID')
    
    args = parser.parse_args()
    
    try:
        # Run async fetch
        if sys.platform == 'win32':
            asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
        
        details = asyncio.run(fetch_job_details(args.job_id))
        
        # Restore stdout and output JSON
        sys.stdout = original_stdout
        
        if details:
            print(json.dumps(details, indent=2, ensure_ascii=False))
            sys.exit(0)
        else:
            print(json.dumps({"error": "Failed to fetch job details"}, ensure_ascii=False), file=sys.stderr)
            sys.exit(1)
        
    except Exception as e:
        print(f"Fatal error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
