# ---------------------------------------------------------------------------
# Elevendots-Pulse Crawler — RSS / Atom Feed Parser
# Parses RSS and Atom feeds through our own HTTP stack for consistent
# rate limiting, SSRF protection, and User-Agent identification.
#
# Developer: Parikshit Dubey
# Contact:   support@elevendots.ai
# ---------------------------------------------------------------------------

import logging
from datetime import datetime, timezone
from time import mktime

import feedparser
from dateutil import parser as dateparser

from .utils import clean_html, is_safe_url, rate_limited_get

logger = logging.getLogger(__name__)


def normalize_date(entry) -> str:
    """Extract and normalize publication date from a feed entry."""
    for field in ("published_parsed", "updated_parsed", "created_parsed"):
        parsed = getattr(entry, field, None) or entry.get(field)
        if parsed:
            try:
                dt = datetime.fromtimestamp(mktime(parsed), tz=timezone.utc)
                return dt.isoformat()
            except Exception:
                continue

    for field in ("published", "updated", "created"):
        raw = entry.get(field, "")
        if raw:
            try:
                dt = dateparser.parse(raw)
                if dt and dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                if dt:
                    return dt.isoformat()
            except Exception:
                continue

    return datetime.now(timezone.utc).isoformat()


def extract_summary(entry) -> str:
    """Extract a clean summary from feed entry (max 500 chars)."""
    summary = entry.get("summary", "")
    if not summary and "content" in entry:
        contents = entry["content"]
        if isinstance(contents, list) and len(contents) > 0:
            summary = contents[0].get("value", "")
    return clean_html(summary)[:300]


def parse_rss_feed(url: str) -> list[dict]:
    """
    Parse an RSS/Atom feed and return list of article dicts.

    Each dict: {title, url, published, summary}

    The feed is fetched through rate_limited_get() (not feedparser's built-in
    HTTP client) so that SSRF protection, rate limiting, redirect caps, and
    our User-Agent header are consistently applied.
    """
    if not is_safe_url(url):
        logger.warning("Blocked RSS feed URL (SSRF): %s", url)
        return []

    # Fetch feed content ourselves, then parse from string
    try:
        resp = rate_limited_get(url)
        resp.raise_for_status()
    except Exception as exc:
        logger.warning("Failed to fetch feed %s: %s", url, exc)
        return []

    feed = feedparser.parse(resp.text)

    articles = []
    for entry in feed.entries:
        link = entry.get("link", "") or entry.get("id", "")
        if not link or not link.startswith("http"):
            continue

        # Validate each article URL against SSRF blocklist
        if not is_safe_url(link):
            logger.debug("Skipped article with unsafe URL: %s", link)
            continue

        title = entry.get("title", "").strip()
        if not title:
            continue

        articles.append({
            "title": title,
            "url": link,
            "published": normalize_date(entry),
            "summary": extract_summary(entry),
        })

    return articles
