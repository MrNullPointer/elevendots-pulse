# ---------------------------------------------------------------------------
# Elevendots-Pulse Crawler — Robots.txt Checker
# Validates robots.txt permissions before crawling, with proper User-Agent
# identification, timeout handling, and Crawl-delay respect.
#
# Developer: Parikshit Dubey
# Contact:   support@elevendots.ai
# ---------------------------------------------------------------------------

import logging
from io import StringIO
from urllib.parse import urlparse
from urllib.robotparser import RobotFileParser

from .utils import USER_AGENT, is_safe_url, rate_limited_get, set_crawl_delay

logger = logging.getLogger(__name__)

_robots_cache: dict[str, RobotFileParser] = {}

# Cap cache size to prevent unbounded memory growth in long-running processes
_MAX_CACHE_SIZE = 500

# Timeout for fetching robots.txt (seconds)
_ROBOTS_TIMEOUT = 10


def _fetch_robots_txt(robots_url: str) -> str | None:
    """
    Fetch robots.txt using our own HTTP stack.

    This ensures we:
      - Send our real User-Agent (not Python-urllib default)
      - Apply SSRF protection and rate limiting
      - Enforce a short timeout so a slow server can't block the crawl
    Returns the robots.txt body, or None on failure.
    """
    try:
        resp = rate_limited_get(robots_url, timeout=_ROBOTS_TIMEOUT)
        if resp.status_code == 200:
            return resp.text
        # 4xx/5xx — treat as "no robots.txt" (allow all)
        return None
    except Exception as exc:
        logger.debug("Could not fetch robots.txt at %s: %s", robots_url, exc)
        return None


def _parse_crawl_delay(robots_text: str, domain: str) -> None:
    """
    Extract Crawl-delay for our User-Agent from raw robots.txt text
    and register it with the rate limiter.
    """
    # RobotFileParser.crawl_delay() is available but unreliable across
    # Python versions, so we parse manually as a safety net.
    import re

    current_agent_matches = False
    ua_lower = USER_AGENT.lower().split("/")[0]  # "elevendotspulse"

    for line in robots_text.splitlines():
        line = line.strip()
        if line.lower().startswith("user-agent:"):
            agent = line.split(":", 1)[1].strip().lower()
            current_agent_matches = agent in ("*", ua_lower)
        elif current_agent_matches and line.lower().startswith("crawl-delay:"):
            try:
                delay = float(line.split(":", 1)[1].strip())
                if 0 < delay <= 60:  # cap at 60 s to avoid abuse
                    set_crawl_delay(domain, delay)
                    logger.info(
                        "Respecting Crawl-delay of %.1fs for %s", delay, domain
                    )
            except ValueError:
                pass


def is_crawling_allowed(url: str) -> bool:
    """
    Check if robots.txt allows our User-Agent to crawl this URL.

    - Fetches robots.txt with our own User-Agent (not urllib default)
    - Applies timeout to prevent blocking on slow servers
    - Extracts and registers Crawl-delay with the rate limiter
    - Results are cached per domain for the duration of the crawl
    - If robots.txt cannot be fetched, assumes crawling is allowed
    - Validates URL safety (SSRF) before fetching robots.txt
    """
    parsed = urlparse(url)
    domain = parsed.netloc

    if domain in _robots_cache:
        return _robots_cache[domain].can_fetch(USER_AGENT, url)

    robots_url = f"{parsed.scheme}://{domain}/robots.txt"

    # SSRF check: don't fetch robots.txt from internal networks
    if not is_safe_url(robots_url):
        logger.warning(
            "Blocked robots.txt fetch for internal URL: %s", robots_url
        )
        return False

    robots_text = _fetch_robots_txt(robots_url)

    rp = RobotFileParser()
    if robots_text is not None:
        # Feed raw text directly instead of using rp.read() (which uses urllib)
        rp.parse(robots_text.splitlines())
        _parse_crawl_delay(robots_text, domain)
    else:
        rp.allow_all = True

    # Evict oldest entry if cache is full
    if len(_robots_cache) >= _MAX_CACHE_SIZE:
        oldest_key = next(iter(_robots_cache))
        del _robots_cache[oldest_key]

    _robots_cache[domain] = rp
    return rp.can_fetch(USER_AGENT, url)


def clear_cache() -> None:
    """Clear the robots.txt cache (call between crawl runs if needed)."""
    _robots_cache.clear()
