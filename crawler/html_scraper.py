# ---------------------------------------------------------------------------
# Elevendots-Pulse Crawler — HTML Scraper
# Scrapes articles from HTML pages that lack RSS feeds, with Content-Type
# validation, response size limits, and proper gzip handling.
#
# Developer: Parikshit Dubey
# Contact:   support@elevendots.ai
# ---------------------------------------------------------------------------

import logging
from datetime import datetime, timezone
from urllib.parse import urljoin

from bs4 import BeautifulSoup
from dateutil import parser as dateparser

from .utils import (
    MAX_RESPONSE_BYTES,
    is_html_content_type,
    is_safe_url,
    rate_limited_get,
)

logger = logging.getLogger(__name__)

MAX_ARTICLES_PER_PAGE = 30


def scrape_html_source(url: str, selectors: dict) -> list[dict]:
    """
    Scrape articles from an HTML page using CSS selectors.

    Returns list of {title, url, published, summary} dicts.

    Safety measures:
      - Validates all extracted URLs against SSRF blocklist
      - Limits response body to MAX_RESPONSE_BYTES (5 MB)
      - Verifies Content-Type is HTML before parsing
      - Handles gzip-encoded responses correctly
    """
    response = rate_limited_get(url, stream=True)
    response.raise_for_status()

    # Verify the response is actually HTML
    if not is_html_content_type(response):
        ct = response.headers.get("Content-Type", "unknown")
        logger.warning("Skipped non-HTML response from %s (type: %s)", url, ct)
        response.close()
        return []

    # Ensure gzip/deflate/br are decoded transparently
    response.raw.decode_content = True

    # Read with a size cap to prevent memory exhaustion
    body = response.raw.read(MAX_RESPONSE_BYTES)
    response.close()
    html = body.decode("utf-8", errors="ignore")

    soup = BeautifulSoup(html, "lxml")

    article_sel = selectors.get("article", "article")
    title_sel = selectors.get("title", "h3")
    link_sel = selectors.get("link", "a")
    date_sel = selectors.get("date", "time")

    articles = []
    for container in soup.select(article_sel)[:MAX_ARTICLES_PER_PAGE]:
        try:
            title_el = container.select_one(title_sel)
            if not title_el:
                continue
            title = title_el.get_text(strip=True)
            if not title or len(title) < 10:
                continue

            link_el = container.select_one(link_sel)
            if not link_el:
                link_el = title_el.find_parent("a") or title_el.find("a")
            if not link_el:
                continue

            href = link_el.get("href", "")
            if not href:
                continue
            article_url = urljoin(url, href)

            # Validate resolved URL: scheme + SSRF check
            if not article_url.startswith("http"):
                continue
            if not is_safe_url(article_url):
                logger.debug("Skipped scraped link (SSRF): %s", article_url)
                continue

            published = datetime.now(timezone.utc).isoformat()
            date_el = container.select_one(date_sel)
            if date_el:
                date_str = (
                    date_el.get("datetime", "") or date_el.get_text(strip=True)
                )
                if date_str:
                    try:
                        dt = dateparser.parse(date_str)
                        if dt:
                            if dt.tzinfo is None:
                                dt = dt.replace(tzinfo=timezone.utc)
                            published = dt.isoformat()
                    except Exception:
                        pass

            summary = ""
            p_el = container.select_one("p")
            if p_el:
                summary = p_el.get_text(strip=True)[:300]

            articles.append({
                "title": title,
                "url": article_url,
                "published": published,
                "summary": summary,
            })
        except Exception:
            continue

    return articles
