# scraper/token_manager.py
"""
Handles token and session management for UpworkScraper.
"""
import time
import random
import uuid
import os

class TokenManager:
    def __init__(self, scraper, browser_cookies, base_headers):
        self.scraper = scraper
        self.browser_cookies = browser_cookies
        self.base_headers = base_headers
        self.current_auth_token = None
        self.current_visitor_id = None
        self.visitor_topnav_gql_token = None
        self.session_trace_id = None
        self.session_span_id = None
        self.session_parent_span_id = None
        self.last_gql_errors = None

    def update_dynamic_cookies(self):
        current_time = int(time.time() * 1000)
        self.browser_cookies.update({
            "__cf_bm": f"gqBVQ8Ks4ZKFuztbZHW287bFjmS3nz9H0gVG0Tbr8Xs-{current_time}-1.0.1.1-4SuJMW.wzD6yuAHf.kAfxPG6CTBfhWZxtfAiAwuumEwA6FOREaafpnY0l936x7Iuon7.NhOc99tXuOaKjhlw5Dh9MT1Llpo4VxDuEdRGHhg",
            "_ga_KSM221PNDX": f"GS2.1.s{current_time}$o16$g1$t{current_time + 30}$j30$l0$h0",
            "IR_13634": f"{current_time}%7C0%7C{current_time}%7C%7C"
        })

    def generate_session_ids(self):
        self.session_trace_id = f"{random.randint(100000000000000, 999999999999999):x}-KHI"
        self.session_span_id = str(uuid.uuid4())
        self.session_parent_span_id = str(uuid.uuid4())
        self.base_headers.update({
            "Vnd-Eo-Parent-Span-Id": self.session_parent_span_id,
            "Vnd-Eo-Span-Id": self.session_span_id,
            "Vnd-Eo-Trace-Id": self.session_trace_id
        })

    # ...other methods from upwork_scraper.py related to token/session management...

    def get_current_cookies(self):
        self.update_dynamic_cookies()
        return self.browser_cookies

    def get_current_headers(self):
        headers = self.base_headers.copy()
        if self.current_auth_token:
            headers["Authorization"] = f"Bearer {self.current_auth_token}"
        return headers

    def get_token_status(self):
        return {
            "current_visitor_id": self.current_visitor_id[:20] + "..." if self.current_visitor_id else None,
            "current_auth_token": self.current_auth_token[:20] + "..." if self.current_auth_token else None,
            "visitor_topnav_gql_token": self.visitor_topnav_gql_token[:20] + "..." if self.visitor_topnav_gql_token else None,
            "session_trace_id": self.session_trace_id,
            "session_span_id": self.session_span_id[:20] + "..." if self.session_span_id else None,
            "cookies_count": len(self.browser_cookies)
        }
