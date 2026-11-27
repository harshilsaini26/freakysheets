"""Tiny SEC EDGAR client (standard library only).

SEC fair-access rules: identify yourself with a User-Agent that contains a
name and contact email, and stay under 10 requests/second.
https://www.sec.gov/os/accessing-edgar-data
"""
import gzip
import json
import os
import time
import urllib.error
import urllib.request
from pathlib import Path

TICKERS_URL = "https://www.sec.gov/files/company_tickers.json"
FACTS_URL = "https://data.sec.gov/api/xbrl/companyfacts/CIK{cik:010d}.json"
MIN_INTERVAL = 0.15  # seconds between requests (~6.6 req/s)


class SecClient:
    def __init__(self, user_agent, cache_dir, refresh=False, offline=False):
        if not offline and (not user_agent or "@" not in user_agent):
            raise SystemExit(
                "SEC requires a User-Agent with a name and email, e.g.\n"
                '  export SEC_USER_AGENT="Jane Doe jane@example.com"\n'
                "or pass --user-agent.")
        self.user_agent = user_agent
        self.cache = Path(cache_dir)
        self.cache.mkdir(parents=True, exist_ok=True)
        self.refresh = refresh
        self.offline = offline
        self._last = 0.0

    # ----------------------------------------------------------------- internals
    def _get(self, url, retries=4):
        for attempt in range(retries):
            wait = MIN_INTERVAL - (time.time() - self._last)
            if wait > 0:
                time.sleep(wait)
            req = urllib.request.Request(url, headers={
                "User-Agent": self.user_agent, "Accept-Encoding": "gzip"})
            try:
                with urllib.request.urlopen(req, timeout=60) as r:
                    self._last = time.time()
                    body = r.read()
                    if r.headers.get("Content-Encoding") == "gzip":
                        body = gzip.decompress(body)
                    return json.loads(body)
            except urllib.error.HTTPError as e:
                self._last = time.time()
                if e.code == 404:
                    return None
                if e.code in (429, 500, 502, 503) and attempt < retries - 1:
                    time.sleep(2 ** attempt * 2)
                    continue
                raise
            except urllib.error.URLError:
                if attempt < retries - 1:
                    time.sleep(2 ** attempt * 2)
                    continue
                raise

    def _cached(self, name, url):
        path = self.cache / name
        if path.exists() and (not self.refresh or self.offline):
            return json.loads(path.read_text())
        if self.offline:
            raise FileNotFoundError(f"{path} not cached and --offline is set")
        data = self._get(url)
        if data is not None:
            path.write_text(json.dumps(data))
        return data

    # -------------------------------------------------------------------- public
    def ticker_map(self):
        """{'AAPL': 320193, 'BRK-B': 1067983, ...}"""
        raw = self._cached("company_tickers.json", TICKERS_URL)
        return {v["ticker"].upper(): int(v["cik_str"]) for v in raw.values()}

    def company_facts(self, cik):
        return self._cached(f"CIK{cik:010d}.json", FACTS_URL.format(cik=cik))


def default_user_agent():
    return os.environ.get("SEC_USER_AGENT", "")
