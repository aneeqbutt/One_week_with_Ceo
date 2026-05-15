# How to Export and Use Upwork Cookies

1. **Open Upwork in your browser and log in.**
2. **Solve any CAPTCHA if prompted.**
3. **Open browser DevTools (F12), go to the Application/Storage tab, and find the 'Cookies' section for upwork.com.**
4. **Export all cookies as JSON.**
   - You can use browser extensions like "EditThisCookie" (Chrome) or "Cookie-Editor" (Firefox/Chrome) to export cookies as JSON.
   - Make sure the exported file includes at least: `cf_bm`, `XSRF-TOKEN`, `upwork_auth` (and/or `oDeskAuth`).
5. **Save the exported JSON as `cookies/upwork.json` in your project directory.**
6. **Restart your bot.**

> The bot will now use these cookies for authentication. If you get a 403 or CAPTCHA again, repeat this process to refresh your cookies.

---

**Troubleshooting:**

- If you see errors about missing cookies, double-check the file path and format.
- Only the required cookies are used for requests; extra cookies are ignored.
- If you change browsers or accounts, re-export the cookies.
