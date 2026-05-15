import os
from dotenv import load_dotenv

load_dotenv()

DISCORD_TOKEN = os.getenv("DISCORD_TOKEN")
DISCORD_CHANNEL_ID = int(os.getenv("DISCORD_CHANNEL_ID"))
DISCORD_CHANNEL_ID2 = int(os.getenv("DISCORD_CHANNEL_ID2"))


POSTGRES_URL = os.getenv("POSTGRES_URL")
UPWORK_EMAIL = os.getenv("UPWORK_EMAIL")
UPWORK_PASSWORD = os.getenv("UPWORK_PASSWORD")
# 2captcha API key (add to your .env file)
CAPTCHA_API_KEY = os.getenv("TWO_CAPTCHA_API_KEY")

# Gemini AI config for BHW scraper
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL")

# BHW Scraper config
BHW_SCRAPER_PAGES = int(os.getenv("BHW_SCRAPER_PAGES", 1))
BHW_SCRAPER_DELAY = int(os.getenv("BHW_SCRAPER_DELAY", 2))
BHW_DETAIL_DELAY = int(os.getenv("BHW_DETAIL_DELAY", 2))
BHW_MAX_RETRIES = int(os.getenv("BHW_MAX_RETRIES", 2))
BHW_RETRY_DELAY = int(os.getenv("BHW_RETRY_DELAY", 2))
BHW_FILTER_TODAY = os.getenv("BHW_FILTER_TODAY", "0") == "1"

PROXIES = [
    "http://mvpidhan:bt1per0s2glt@64.137.96.74:6641",
    "http://mvpidhan:bt1per0s2glt@45.43.186.39:6257",
    "http://mvpidhan:bt1per0s2glt@154.203.43.247:5536",
    "http://mvpidhan:bt1per0s2glt@216.10.27.159:6837",
    "http://mvpidhan:bt1per0s2glt@136.0.207.84:6661",
    "http://mvpidhan:bt1per0s2glt@142.147.128.93:6593",
    "http://mvpidhan:bt1per0s2glt@107.172.163.27:6543"
]