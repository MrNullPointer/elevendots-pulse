# ---------------------------------------------------------------------------
# Elevendots-Pulse Crawler — Intro Text Fetcher
# Extracts article preview text from RSS descriptions or page meta tags.
# Respects robots.txt, nosnippet/max-snippet directives, and HTTP status.
#
# Developer: Parikshit Dubey
# Contact:   support@elevendots.ai
# ---------------------------------------------------------------------------

import logging
import re

from bs4 import BeautifulSoup

from .robots_checker import is_crawling_allowed
from .utils import clean_html, is_html_content_type, is_safe_url, rate_limited_get

logger = logging.getLogger(__name__)

MAX_INTRO_LENGTH = 300
PARTIAL_READ_BYTES = 20_000


def fetch_intro(
    article_url: str,
    rss_summary: str = "",
    preview_mode: str = "rss_description",
) -> str:
    """
    Get the best available intro text for an article.

    Priority: RSS summary > og:description > meta description.

    Legal safeguards:
      - Checks robots.txt before fetching any article page
      - Respects nosnippet / max-snippet robot meta directives
      - Only reads publicly exposed metadata (og:description, meta description)
      - Verifies HTTP status is 2xx before parsing
      - Validates Content-Type is HTML before parsing

    Returns at most 300 chars. Never raises.
    """
    # Title-only mode — return nothing
    if preview_mode == "title_only":
        return ""

    # Priority 1: RSS summary (no extra request needed)
    if rss_summary and len(rss_summary) > 50:
        return clean_html(rss_summary)[:MAX_INTRO_LENGTH]

    # Priority 2: Fetch og:description from page <head>
    if preview_mode in ("og_description", "rss_description"):
        try:
            # SSRF check
            if not is_safe_url(article_url):
                logger.debug("Skipped intro fetch (SSRF): %s", article_url)
                return ""

            # Robots.txt check — legal requirement before touching the page
            if not is_crawling_allowed(article_url):
                logger.debug(
                    "Skipped intro fetch (robots.txt): %s", article_url
                )
                return ""

            resp = rate_limited_get(article_url, stream=True)

            # Only parse successful HTML responses
            if resp.status_code >= 400:
                resp.close()
                return ""
            if not is_html_content_type(resp):
                resp.close()
                return ""

            # Ensure gzip/deflate/br are decoded transparently
            resp.raw.decode_content = True

            partial = resp.raw.read(PARTIAL_READ_BYTES).decode(
                "utf-8", errors="ignore"
            )
            resp.close()

            soup = BeautifulSoup(partial, "lxml")

            # Check for nosnippet directive
            robots_meta = soup.find("meta", attrs={"name": "robots"})
            max_len = MAX_INTRO_LENGTH
            if robots_meta:
                content = (robots_meta.get("content") or "").lower()
                if "nosnippet" in content:
                    return ""
                ms = re.search(r"max-snippet\s*:\s*(\d+)", content)
                if ms:
                    max_len = min(int(ms.group(1)), MAX_INTRO_LENGTH)

            # Try og:description
            og = soup.find("meta", property="og:description")
            if og and og.get("content"):
                return clean_html(og["content"])[:max_len]

            # Try meta description
            meta = soup.find("meta", attrs={"name": "description"})
            if meta and meta.get("content"):
                return clean_html(meta["content"])[:max_len]

        except Exception:
            pass

    # Fallback: return RSS summary even if short
    if rss_summary:
        return clean_html(rss_summary)[:MAX_INTRO_LENGTH]

    return ""
