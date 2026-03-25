# ---------------------------------------------------------------------------
# Elevendots-Pulse Crawler — OpenAlex API Adapter
#
# Fetches recent academic papers from OpenAlex (openalex.org).
# OpenAlex data is CC0 licensed — no restrictions on commercial use.
#
# API docs: https://docs.openalex.org/api-entities/works
# Rate limit: 10 req/sec with API key, 100K credits/day (free tier)
#
# Developer: Parikshit Dubey
# Contact:   support@elevendots.ai
# ---------------------------------------------------------------------------

import logging
import os
import time
from datetime import datetime, timedelta, timezone

import requests

from .utils import USER_AGENT, HEADERS

CRAWL_TIMEOUT = int(os.environ.get("CRAWL_TIMEOUT", 15))

logger = logging.getLogger(__name__)

# OpenAlex polite pool: include email in requests
OPENALEX_EMAIL = "support@elevendots.ai"
OPENALEX_BASE = "https://api.openalex.org"

# Rate limit: be conservative (max 5 req/sec, well under the 10/sec limit)
_last_request_time = 0
_MIN_INTERVAL = 0.25  # 250ms between requests


def _rate_limited_get(url, params=None):
    """Make a rate-limited GET request to OpenAlex API."""
    global _last_request_time
    now = time.time()
    elapsed = now - _last_request_time
    if elapsed < _MIN_INTERVAL:
        time.sleep(_MIN_INTERVAL - elapsed)

    if params is None:
        params = {}
    params["mailto"] = OPENALEX_EMAIL

    try:
        resp = requests.get(
            url,
            params=params,
            headers={"User-Agent": USER_AGENT},
            timeout=CRAWL_TIMEOUT,
        )
        _last_request_time = time.time()
        resp.raise_for_status()
        return resp.json()
    except requests.exceptions.RequestException as e:
        logger.warning("OpenAlex request failed: %s — %s", url, e)
        return None


def _extract_abstract(inverted_index):
    """Reconstruct abstract text from OpenAlex inverted index format."""
    if not inverted_index:
        return ""
    # Inverted index: {"word": [position1, position2, ...], ...}
    positions = {}
    for word, indices in inverted_index.items():
        for idx in indices:
            positions[idx] = word

    if not positions:
        return ""

    max_pos = max(positions.keys())
    words = [positions.get(i, "") for i in range(max_pos + 1)]
    abstract = " ".join(w for w in words if w)
    return abstract[:500]  # Cap at 500 chars for compliance


def _classify_venue_type(work):
    """Determine paper type from OpenAlex work metadata."""
    work_type = work.get("type", "")
    # OpenAlex types: article, book-chapter, dataset, dissertation,
    # editorial, erratum, letter, paratext, peer-review, preprint,
    # reference-entry, report, review, standard
    if work_type == "preprint":
        return "preprint"

    # Check if it's from a known preprint server
    source = work.get("primary_location", {}).get("source", {})
    source_type = source.get("type", "")
    if source_type == "repository":
        return "preprint"

    if work_type == "article":
        if source_type == "journal":
            return "journal"
        if source_type == "conference":
            return "conference"
        return "journal"  # Default for articles

    if work_type in ("book-chapter", "report"):
        return "proceedings"

    return "unknown"


def _format_authors(authorships, max_authors=3):
    """Format author list for display."""
    if not authorships:
        return ""
    names = []
    for auth in authorships[:max_authors]:
        name = auth.get("author", {}).get("display_name", "")
        if name:
            names.append(name)

    if not names:
        return ""

    result = ", ".join(names)
    remaining = len(authorships) - max_authors
    if remaining > 0:
        result += f" et al. ({len(authorships)} authors)"
    return result


def _format_intro(work):
    """Build a rich intro string with abstract, authors, and venue."""
    parts = []

    # Authors
    authors = _format_authors(work.get("authorships", []))
    if authors:
        parts.append(authors)

    # Venue
    source = work.get("primary_location", {}).get("source", {})
    venue = source.get("display_name", "")
    if venue:
        year = work.get("publication_year", "")
        venue_str = f"{venue} ({year})" if year else venue
        parts.append(venue_str)

    # Abstract
    abstract = _extract_abstract(work.get("abstract_inverted_index"))
    if abstract:
        parts.append(abstract)

    intro = " · ".join(parts) if parts else ""
    return intro[:300]  # Comply with 300-char limit


def fetch_openalex_papers(query_config):
    """
    Fetch recent papers from OpenAlex for a given query configuration.

    query_config is a dict with:
      - topics: list of OpenAlex topic IDs or concept IDs
      - keywords: list of search keywords (fallback if no topic IDs)
      - from_date: ISO date string (default: 7 days ago)
      - max_results: max papers to return (default: 50)

    Returns list of article dicts matching the standard crawler format:
      {title, url, published, summary}
    """
    from_date = query_config.get("from_date")
    if not from_date:
        from_date = (datetime.now(timezone.utc) - timedelta(days=7)).strftime("%Y-%m-%d")

    max_results = min(query_config.get("max_results", 50), 50)

    # Build filter string
    filters = [
        f"from_publication_date:{from_date}",
        "has_abstract:true",
        "language:en",
    ]

    # Add topic/keyword filter
    keywords = query_config.get("keywords", [])
    search_query = None
    if keywords:
        search_query = " OR ".join(keywords)

    filter_str = ",".join(filters)

    params = {
        "filter": filter_str,
        "sort": "publication_date:desc",
        "per_page": max_results,
        "select": "id,title,authorships,publication_date,primary_location,"
                  "open_access,cited_by_count,type,doi,"
                  "abstract_inverted_index,topics",
    }

    if search_query:
        params["search"] = search_query

    data = _rate_limited_get(f"{OPENALEX_BASE}/works", params)
    if not data:
        return []

    results = data.get("results", [])
    articles = []

    for work in results:
        title = work.get("title", "")
        if not title or len(title) < 10:
            continue

        # Get best URL (prefer DOI landing page, then OA URL)
        doi = work.get("doi", "")
        landing_url = ""
        if doi:
            landing_url = doi  # DOI URLs are canonical
        else:
            location = work.get("primary_location", {})
            landing_url = location.get("landing_page_url", "")

        if not landing_url:
            # Use OpenAlex URL as fallback
            oa_id = work.get("id", "")
            landing_url = oa_id.replace("https://openalex.org/", "https://openalex.org/works/") if oa_id else ""

        if not landing_url:
            continue

        # Publication date
        pub_date = work.get("publication_date", "")

        # Build summary with authors, venue, abstract
        intro = _format_intro(work)

        # Determine paper type
        venue_type = _classify_venue_type(work)
        is_preprint = venue_type == "preprint"

        articles.append({
            "title": title.strip(),
            "url": landing_url,
            "published": pub_date if pub_date else None,
            "summary": intro,
        })

    return articles
