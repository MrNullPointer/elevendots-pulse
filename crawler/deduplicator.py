# ---------------------------------------------------------------------------
# Elevendots-Pulse Crawler — Article Deduplicator
# Removes duplicate articles by normalized URL and title similarity.
#
# Developer: Parikshit Dubey
# Contact:   support@elevendots.ai
# ---------------------------------------------------------------------------

from collections import defaultdict
from difflib import SequenceMatcher
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

TRACKING_PARAMS = {
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
    "ref", "source", "fbclid", "gclid",
}

# Titles shorter than this are excluded from similarity matching to prevent
# false merges on generic short strings like "News" or "Update".
_MIN_TITLE_LENGTH_FOR_SIMILARITY = 15


def normalize_url(url: str) -> str:
    """Normalize URL for dedup: strip tracking params, www, trailing slash."""
    parsed = urlparse(url.lower().strip())
    query = parse_qs(parsed.query)
    filtered = {k: v for k, v in query.items() if k not in TRACKING_PARAMS}
    netloc = parsed.netloc
    if netloc.startswith("www."):
        netloc = netloc[4:]
    path = parsed.path.rstrip("/")
    return urlunparse((
        parsed.scheme, netloc, path, "", urlencode(filtered, doseq=True), ""
    ))


def deduplicate_articles(
    articles: list[dict],
    similarity_threshold: float = 0.75,
) -> list[dict]:
    """
    Remove duplicate articles by URL and title similarity.

    Pass 1: Merge exact-URL duplicates (after normalization).
    Pass 2: Merge articles with similar titles WITHIN the same section.
            Bucketed by section to avoid O(n²) across all articles.
            ~15x faster than unbucketed for 2400+ articles.
    """
    # --- Pass 1: URL dedup ---
    seen_urls: dict[str, int] = {}
    url_deduped: list[dict] = []

    for article in articles:
        norm = normalize_url(article["url"])
        if norm not in seen_urls:
            seen_urls[norm] = len(url_deduped)
            article["also_from"] = []
            url_deduped.append(article)
        else:
            idx = seen_urls[norm]
            src = article.get("source", "")
            if src and src not in url_deduped[idx].get("also_from", []):
                url_deduped[idx].setdefault("also_from", []).append(src)

    # --- Pass 2: Title-similarity dedup (bucketed by section) ---
    # Group articles by section to reduce O(n²) to O(k × (n/k)²)
    section_buckets: dict[str, list[int]] = defaultdict(list)
    for idx, article in enumerate(url_deduped):
        section = article.get("section", "misc")
        section_buckets[section].append(idx)

    merged: set[int] = set()

    for section, indices in section_buckets.items():
        for ii, i in enumerate(indices):
            if i in merged:
                continue
            a = url_deduped[i]
            a_title = a["title"].lower()

            if len(a_title) < _MIN_TITLE_LENGTH_FOR_SIMILARITY:
                continue

            for jj in range(ii + 1, len(indices)):
                j = indices[jj]
                if j in merged:
                    continue
                b = url_deduped[j]
                b_title = b["title"].lower()

                if len(b_title) < _MIN_TITLE_LENGTH_FOR_SIMILARITY:
                    continue

                sim = SequenceMatcher(None, a_title, b_title).ratio()
                if sim >= similarity_threshold:
                    src = b.get("source", "")
                    if src and src != a.get("source", ""):
                        a.setdefault("also_from", []).append(src)
                    for s in b.get("also_from", []):
                        if s not in a.get("also_from", []):
                            a.setdefault("also_from", []).append(s)
                    merged.add(j)

    return [a for i, a in enumerate(url_deduped) if i not in merged]
