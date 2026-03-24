# ---------------------------------------------------------------------------
# Elevendots-Pulse Crawler — Utility Functions
# Rate limiting, URL validation, HTTP helpers, and common utilities.
#
# Developer: Parikshit Dubey
# Contact:   support@elevendots.ai
# ---------------------------------------------------------------------------

import hashlib
import ipaddress
import logging
import os
import re
import socket
import time
from collections import defaultdict
from datetime import datetime, timezone
from urllib.parse import urlparse

import requests
from dateutil import parser as dateparser

logger = logging.getLogger(__name__)

USER_AGENT = (
    "ElevendotsPulse/1.0 "
    "(News Aggregator; https://elevendots.dev; support@elevendots.ai)"
)

HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

TIMEOUT = int(os.environ.get("CRAWL_TIMEOUT", 15))
MAX_RESPONSE_BYTES = 5 * 1024 * 1024  # 5 MB hard cap for full-page fetches
MAX_REDIRECTS = 5

_last_request_time: dict[str, float] = defaultdict(float)
_MIN_INTERVAL = 1.5  # seconds between requests to the same domain

# Per-domain crawl-delay overrides (populated by robots_checker)
_crawl_delays: dict[str, float] = {}

# --- Private-network ranges (SSRF protection) ---
_PRIVATE_NETWORKS = [
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),  # link-local / cloud metadata
    ipaddress.ip_network("0.0.0.0/8"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),  # IPv6 private
    ipaddress.ip_network("fe80::/10"),  # IPv6 link-local
]

ALLOWED_SCHEMES = {"http", "https"}


def get_domain(url: str) -> str:
    """Extract domain from URL."""
    return urlparse(url).netloc


def is_safe_url(url: str) -> bool:
    """
    Validate that a URL is safe to fetch (SSRF protection).

    Blocks:
      - Non-http(s) schemes (file://, ftp://, gopher://, etc.)
      - Private/internal IP addresses (127.x, 10.x, 169.254.x, etc.)
      - Localhost and common internal hostnames
    """
    try:
        parsed = urlparse(url)

        # Scheme check
        if parsed.scheme not in ALLOWED_SCHEMES:
            logger.warning("Blocked non-HTTP scheme: %s", parsed.scheme)
            return False

        hostname = parsed.hostname
        if not hostname:
            return False

        # Block obvious internal hostnames
        blocked_hosts = {"localhost", "metadata.google.internal"}
        if hostname in blocked_hosts:
            logger.warning("Blocked internal hostname: %s", hostname)
            return False

        # Resolve hostname and check all IPs against private ranges
        try:
            addrinfos = socket.getaddrinfo(hostname, None)
        except socket.gaierror:
            # Cannot resolve — allow; will fail at request time
            return True

        for _family, _type, _proto, _canonname, sockaddr in addrinfos:
            ip = ipaddress.ip_address(sockaddr[0])
            for network in _PRIVATE_NETWORKS:
                if ip in network:
                    logger.warning(
                        "Blocked private IP %s for host %s", ip, hostname
                    )
                    return False
        return True

    except Exception:
        return False


def set_crawl_delay(domain: str, delay: float) -> None:
    """Register a Crawl-delay for a domain (called by robots_checker)."""
    _crawl_delays[domain] = delay


def _build_session() -> requests.Session:
    """Build a requests.Session with restricted redirect count."""
    session = requests.Session()
    session.max_redirects = MAX_REDIRECTS
    session.headers.update(HEADERS)
    return session


# Module-level session, reused across the crawl for connection pooling
_session: requests.Session | None = None


def _get_session() -> requests.Session:
    global _session
    if _session is None:
        _session = _build_session()
    return _session


def rate_limited_get(url: str, **kwargs) -> requests.Response:
    """
    Make a GET request with per-domain rate limiting and SSRF protection.

    - Validates URL against private network ranges
    - Enforces minimum 1.5 s between requests to the same domain
      (or longer if the domain's robots.txt specifies Crawl-delay)
    - Caps redirects at 5
    - Raises ValueError for unsafe URLs
    """
    if not is_safe_url(url):
        raise ValueError(f"URL blocked by SSRF protection: {url}")

    domain = get_domain(url)

    # Respect the greater of our minimum interval or robots.txt Crawl-delay
    interval = max(_MIN_INTERVAL, _crawl_delays.get(domain, 0.0))
    elapsed = time.time() - _last_request_time[domain]
    if elapsed < interval:
        time.sleep(interval - elapsed)

    kwargs.setdefault("timeout", TIMEOUT)

    session = _get_session()
    response = session.get(url, **kwargs)
    _last_request_time[domain] = time.time()
    return response


def compute_age_hours(published_str: str) -> float:
    """Compute hours since publication. Returns 999.0 on error."""
    try:
        pub_date = dateparser.parse(published_str)
        if pub_date is None:
            return 999.0
        if pub_date.tzinfo is None:
            pub_date = pub_date.replace(tzinfo=timezone.utc)
        now = datetime.now(timezone.utc)
        delta = now - pub_date
        return round(delta.total_seconds() / 3600, 1)
    except Exception:
        return 999.0


def make_article_id(url: str) -> str:
    """Deterministic 16-char ID from URL using SHA-256."""
    return hashlib.sha256(url.encode("utf-8")).hexdigest()[:16]


def clean_html(text: str) -> str:
    """Strip HTML tags and normalize whitespace."""
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def is_html_content_type(response: requests.Response) -> bool:
    """Check whether a response has an HTML-like Content-Type."""
    ct = response.headers.get("Content-Type", "")
    return any(t in ct.lower() for t in ("text/html", "application/xhtml"))
