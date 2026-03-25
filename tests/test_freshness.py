# ---------------------------------------------------------------------------
# Tests for crawler.freshness — timestamp normalization and sort ordering
# ---------------------------------------------------------------------------

import pytest
from datetime import datetime, timedelta, timezone

from crawler.freshness import (
    classify_freshness_bucket,
    compute_age_hours,
    ensure_utc,
    freshness_sort_key,
    normalize_article_timestamp,
    parse_timestamp,
)


NOW = datetime(2026, 3, 25, 12, 0, 0, tzinfo=timezone.utc)


class TestParseTimestamp:
    def test_none_input(self):
        assert parse_timestamp(None) is None

    def test_empty_string(self):
        assert parse_timestamp("") is None

    def test_valid_iso(self):
        dt = parse_timestamp("2026-03-25T10:00:00Z")
        assert dt is not None
        assert dt.year == 2026
        assert dt.tzinfo is not None

    def test_garbage(self):
        assert parse_timestamp("not-a-date-at-all") is None

    def test_rfc2822(self):
        dt = parse_timestamp("Tue, 25 Mar 2026 10:00:00 +0000")
        assert dt is not None
        assert dt.hour == 10


class TestEnsureUtc:
    def test_naive_gets_utc(self):
        dt = datetime(2026, 1, 1, 12, 0, 0)
        result = ensure_utc(dt)
        assert result.tzinfo is not None

    def test_non_utc_converted(self):
        from datetime import timezone as tz
        est = tz(timedelta(hours=-5))
        dt = datetime(2026, 1, 1, 12, 0, 0, tzinfo=est)
        result = ensure_utc(dt)
        assert result.hour == 17  # 12 EST = 17 UTC


class TestComputeAgeHours:
    def test_two_hours_ago(self):
        ts = NOW - timedelta(hours=2)
        assert compute_age_hours(ts, NOW) == 2.0

    def test_future_clamps_to_zero(self):
        ts = NOW + timedelta(hours=1)
        assert compute_age_hours(ts, NOW) == 0.0

    def test_exact_now(self):
        assert compute_age_hours(NOW, NOW) == 0.0


class TestClassifyBucket:
    def test_last_hour(self):
        assert classify_freshness_bucket(0.5) == "last_hour"

    def test_last_6_hours(self):
        assert classify_freshness_bucket(3.0) == "last_6_hours"

    def test_last_24_hours(self):
        assert classify_freshness_bucket(12.0) == "last_24_hours"

    def test_last_72_hours(self):
        assert classify_freshness_bucket(48.0) == "last_72_hours"

    def test_last_week(self):
        assert classify_freshness_bucket(100.0) == "last_week"

    def test_stale(self):
        assert classify_freshness_bucket(200.0) == "stale"


class TestNormalizeArticleTimestamp:
    def test_missing_date_gets_low_confidence(self):
        observed = NOW - timedelta(hours=1)
        result = normalize_article_timestamp(None, observed, now=NOW)
        assert result["published_confidence"] == "low"
        assert result["timestamp_issue"] == "missing"
        assert result["age_hours"] == 1.0
        # Low-confidence articles are demoted to "last_week" bucket
        # regardless of computed age, to prevent them from outranking
        # genuinely recent high-confidence articles.
        assert result["freshness_bucket"] == "last_week"

    def test_valid_date_gets_high_confidence(self):
        pub = "2026-03-25T10:00:00Z"
        observed = NOW
        result = normalize_article_timestamp(pub, observed, now=NOW)
        assert result["published_confidence"] == "high"
        assert result["timestamp_issue"] == "ok"
        assert result["age_hours"] == 2.0

    def test_future_date_clamped(self):
        future = (NOW + timedelta(hours=2)).isoformat()
        result = normalize_article_timestamp(future, NOW, now=NOW)
        assert result["timestamp_issue"] == "future_clamped"
        assert result["published_confidence"] == "low"
        # Falls back to observed_at, so age = 0
        assert result["age_hours"] == 0.0

    def test_mild_future_skew_clamped(self):
        mild_future = (NOW + timedelta(minutes=2)).isoformat()
        result = normalize_article_timestamp(mild_future, NOW, now=NOW)
        assert result["timestamp_issue"] == "future_skew_clamped"
        assert result["published_confidence"] == "medium"

    def test_invalid_string(self):
        result = normalize_article_timestamp("not-a-date", NOW, now=NOW)
        assert result["timestamp_issue"] == "invalid"
        assert result["published_confidence"] == "low"

    def test_published_at_is_epoch_ms(self):
        pub = "2026-03-25T10:00:00Z"
        result = normalize_article_timestamp(pub, NOW, now=NOW)
        assert isinstance(result["published_at"], int)
        assert result["published_at"] > 0

    def test_freshness_score_monotonic(self):
        """Fresher articles must have LOWER freshness_score."""
        recent = normalize_article_timestamp(
            (NOW - timedelta(minutes=30)).isoformat(), NOW, now=NOW
        )
        old = normalize_article_timestamp(
            (NOW - timedelta(hours=5)).isoformat(), NOW, now=NOW
        )
        ancient = normalize_article_timestamp(
            (NOW - timedelta(days=2)).isoformat(), NOW, now=NOW
        )
        unknown = normalize_article_timestamp(None, NOW, now=NOW)

        assert recent["freshness_score"] < old["freshness_score"]
        assert old["freshness_score"] < ancient["freshness_score"]
        # Unknown-date articles (low confidence) sort AFTER ALL known-date
        # articles, regardless of age bucket.  Confidence is the primary
        # dimension: high-conf articles always outrank low-conf.
        assert unknown["freshness_score"] > ancient["freshness_score"]

    def test_low_conf_demoted_to_last_week_bucket(self):
        """Low-confidence articles should be demoted to 'last_week' bucket."""
        unknown = normalize_article_timestamp(None, NOW, now=NOW)
        assert unknown["freshness_bucket"] == "last_week"
        assert unknown["freshness_bucket_order"] == 4

    def test_low_conf_sorts_after_all_high_conf(self):
        """Low-confidence must sort after even 6-day-old high-confidence."""
        six_day_old = normalize_article_timestamp(
            (NOW - timedelta(days=6)).isoformat(), NOW, now=NOW
        )
        unknown_just_crawled = normalize_article_timestamp(None, NOW, now=NOW)

        assert six_day_old["published_confidence"] == "high"
        assert unknown_just_crawled["published_confidence"] == "low"
        assert six_day_old["freshness_score"] < unknown_just_crawled["freshness_score"]


class TestFreshnessSortKey:
    def test_sort_order_correct(self):
        """Articles should sort: recent-known > old-known > unknown-date.
        Unknown-date articles always sort LAST regardless of apparent age."""
        # Use real normalize_article_timestamp to get correct scores
        recent_known = normalize_article_timestamp(
            (NOW - timedelta(minutes=30)).isoformat(), NOW, now=NOW
        )
        recent_known.update({"title": "Recent", "source": "A"})

        old_known = normalize_article_timestamp(
            (NOW - timedelta(hours=5)).isoformat(), NOW, now=NOW
        )
        old_known.update({"title": "Old", "source": "B"})

        unknown_date = normalize_article_timestamp(None, NOW, now=NOW)
        unknown_date.update({"title": "Unknown", "source": "C"})

        articles = [old_known, unknown_date, recent_known]
        sorted_articles = sorted(articles, key=freshness_sort_key)

        assert sorted_articles[0]["title"] == "Recent"
        assert sorted_articles[1]["title"] == "Old"
        assert sorted_articles[2]["title"] == "Unknown"  # LAST — always

    def test_fallback_without_freshness_score(self):
        """Articles without freshness_score should still sort."""
        legacy = {
            "published": (NOW - timedelta(hours=1)).isoformat(),
            "title": "Legacy",
            "source": "X",
        }
        key = freshness_sort_key(legacy)
        assert isinstance(key, tuple)
        assert len(key) > 0
