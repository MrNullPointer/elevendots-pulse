# ---------------------------------------------------------------------------
# Elevendots-Pulse Crawler — Freshness Scoring
# Converts raw publication timestamps into trustworthy freshness records.
# Missing, invalid, and future-dated timestamps are safely handled.
#
# Developer: Parikshit Dubey
# Contact:   support@elevendots.ai
# ---------------------------------------------------------------------------

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from dateutil import parser as dateparser

# Feeds occasionally publish items a few minutes in the future due to
# clock skew.  Anything beyond this threshold is treated as invalid.
MAX_FUTURE_SKEW = timedelta(minutes=5)

FRESHNESS_BUCKET_ORDER = {
    "last_hour": 0,
    "last_6_hours": 1,
    "last_24_hours": 2,
    "last_72_hours": 3,
    "last_week": 4,
    "stale": 5,
}

TIMESTAMP_CONFIDENCE_ORDER = {
    "high": 0,
    "medium": 1,
    "low": 2,
}


def ensure_utc(dt: datetime) -> datetime:
    """Normalize a datetime to timezone-aware UTC."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def parse_timestamp(value: str | None) -> datetime | None:
    """Best-effort ISO/date parser that always returns UTC datetimes."""
    if not value:
        return None
    try:
        parsed = dateparser.parse(value)
    except Exception:
        return None
    if parsed is None:
        return None
    return ensure_utc(parsed)


def isoformat_utc(dt: datetime) -> str:
    """Serialize a datetime in UTC."""
    return ensure_utc(dt).isoformat()


def compute_age_hours(timestamp: datetime, now: datetime) -> float:
    """Compute age in hours, clamping negatives to zero."""
    age_seconds = max((ensure_utc(now) - ensure_utc(timestamp)).total_seconds(), 0.0)
    return round(age_seconds / 3600, 1)


def classify_freshness_bucket(age_hours: float) -> str:
    """Assign an article to a deterministic freshness bucket."""
    if age_hours <= 1:
        return "last_hour"
    if age_hours <= 6:
        return "last_6_hours"
    if age_hours <= 24:
        return "last_24_hours"
    if age_hours <= 72:
        return "last_72_hours"
    if age_hours <= 168:
        return "last_week"
    return "stale"


def normalize_article_timestamp(
    published_raw: str | None,
    observed_at: datetime,
    now: datetime | None = None,
) -> dict:
    """
    Convert source-provided publication metadata into a trustworthy
    freshness record.

    The output separates the publisher's claimed time from the timestamp
    we actually trust for ranking.  Missing, invalid, and future-dated
    source timestamps fall back to ``observed_at`` so latest-news ranking
    remains sane.

    Parameters
    ----------
    published_raw : str or None
        The ISO/RFC-2822 date string from the feed or scraper.
        ``None`` means the source provided no date at all.
    observed_at : datetime
        When the crawler first observed this article (crawl time).
    now : datetime, optional
        Override for "current time" (useful for deterministic tests).

    Returns
    -------
    dict with keys:
        published, published_at (epoch ms), published_raw,
        published_confidence (high|medium|low),
        timestamp_issue (ok|future_skew_clamped|future_clamped|invalid|missing),
        observed_at, age_hours, freshness_bucket, freshness_bucket_order,
        freshness_score
    """
    observed_at = ensure_utc(observed_at)
    now = ensure_utc(now or datetime.now(timezone.utc))
    parsed = parse_timestamp(published_raw)

    published_confidence = "low"
    effective_published_at = observed_at
    timestamp_issue = "missing"

    if published_raw and parsed is None:
        timestamp_issue = "invalid"
    elif parsed is not None:
        if parsed > observed_at + MAX_FUTURE_SKEW:
            # Wildly future — don't trust at all
            timestamp_issue = "future_clamped"
        elif parsed > observed_at:
            # Mild clock skew — clamp but keep medium confidence
            effective_published_at = observed_at
            published_confidence = "medium"
            timestamp_issue = "future_skew_clamped"
        else:
            effective_published_at = parsed
            published_confidence = "high"
            timestamp_issue = "ok"

    age_hours = compute_age_hours(effective_published_at, now)
    freshness_bucket = classify_freshness_bucket(age_hours)
    bucket_order = FRESHNESS_BUCKET_ORDER[freshness_bucket]

    # Composite score: lower = fresher.
    # bucket (coarse) → confidence (fine) → age in seconds (finest)
    freshness_score = (
        bucket_order * 10_000_000
        + TIMESTAMP_CONFIDENCE_ORDER[published_confidence] * 1_000_000
        + int(age_hours * 3_600)
    )

    return {
        "published": isoformat_utc(effective_published_at),
        "published_at": int(effective_published_at.timestamp() * 1000),
        "published_raw": published_raw or "",
        "published_confidence": published_confidence,
        "timestamp_issue": timestamp_issue,
        "observed_at": isoformat_utc(observed_at),
        "age_hours": age_hours,
        "freshness_bucket": freshness_bucket,
        "freshness_bucket_order": bucket_order,
        "freshness_score": freshness_score,
    }


def freshness_sort_key(article: dict) -> tuple:
    """
    Stable sort key for latest-first ranking.

    Uses freshness_score if present (set by normalize_article_timestamp).
    Falls back to a computed key for articles without freshness metadata.
    """
    if "freshness_score" in article:
        return (
            article["freshness_score"],
            article.get("title", "").lower(),
            article.get("source", "").lower(),
        )

    # Fallback for articles without freshness metadata
    published_at = parse_timestamp(
        article.get("published")
    ) or datetime.fromtimestamp(0, tz=timezone.utc)
    return (
        FRESHNESS_BUCKET_ORDER.get("stale", 5) * 10_000_000,
        -published_at.timestamp(),
        article.get("title", "").lower(),
    )
