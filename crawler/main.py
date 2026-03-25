# ---------------------------------------------------------------------------
# Elevendots-Pulse Crawler — Main Entry Point
# Reads config/sources.yaml, crawls all sources, writes data/articles.json.
#
# Developer: Parikshit Dubey
# Contact:   support@elevendots.ai
# ---------------------------------------------------------------------------

import json
import logging
import os
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path

import requests
import yaml

from .deduplicator import deduplicate_articles
from .feed_parser import parse_rss_feed
from .freshness import freshness_sort_key, normalize_article_timestamp
from .html_scraper import scrape_html_source
from .intro_fetcher import fetch_intro
from .openalex_adapter import fetch_openalex_papers
from .robots_checker import is_crawling_allowed
from .utils import make_article_id

logger = logging.getLogger(__name__)

ROOT = Path(__file__).resolve().parent.parent
CONFIG_DIR = ROOT / "config"
DATA_DIR = ROOT / "data"

_CRAWLER_NAME = "Elevendots-Pulse Crawler"
MAX_CRAWL_TIME = int(os.environ.get("MAX_CRAWL_TIME", 480))  # 8 min default


def load_config() -> dict:
    """Load sources.yaml safely."""
    config_path = CONFIG_DIR / "sources.yaml"
    with open(config_path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


MAX_ARTICLES_PER_SOURCE = int(os.environ.get("MAX_ARTICLES_PER_SOURCE", 50))

# Frontier threshold: preprints ≤ this many hours old are tagged "r-frontier"
FRONTIER_AGE_HOURS = 48


def _compute_subsections(source_subs, extra_subs, section, source_type, age_hours):
    """Merge source-level + article-level subsections, add computed tags."""
    subs = set(source_subs + extra_subs)

    # Frontier: research preprints ≤ 48h old
    # arXiv RSS sources are all preprints; OpenAlex may return extra_subs
    if section == "research" and age_hours <= FRONTIER_AGE_HOURS:
        if source_type in ("rss", "atom"):
            # arXiv feeds are all preprints
            subs.add("r-frontier")
        elif "r-must-read" not in extra_subs:
            # OpenAlex non-must-read papers under 48h = frontier preprints
            # (Must Read papers are established, not frontier)
            subs.add("r-frontier")

    return list(subs)


def crawl_source(source: dict, crawl_start: float = 0, max_crawl_time: int = 0) -> tuple[list[dict], str]:
    """Crawl a single source. Returns (articles, status_string)."""
    source_type = source.get("type", "rss")
    url = source.get("url", "")
    name = source.get("name", "Unknown")
    policy = source.get("policy", {})
    preview_mode = policy.get("preview_mode", "rss_description")

    print(f"  [{source_type}] {name}: {url}")

    # For HTML sources, check robots.txt first
    if source_type == "html":
        if not is_crawling_allowed(url):
            print("    BLOCKED by robots.txt")
            return [], "blocked"

    if source_type in ("rss", "atom"):
        raw_articles = parse_rss_feed(url)
    elif source_type == "html":
        selectors = source.get("selectors", {})
        raw_articles = scrape_html_source(url, selectors)
    elif source_type == "openalex":
        # OpenAlex API source — query config stored in source dict
        query_config = source.get("query", {})
        raw_articles = fetch_openalex_papers(query_config)
    else:
        print(f"    Unknown type: {source_type}")
        return [], "error"

    # Cap articles per source to avoid spending too long on fetch_intro
    if len(raw_articles) > MAX_ARTICLES_PER_SOURCE:
        print(f"    Capping from {len(raw_articles)} to {MAX_ARTICLES_PER_SOURCE} articles")
        raw_articles = raw_articles[:MAX_ARTICLES_PER_SOURCE]

    articles = []
    for raw in raw_articles:
        # Time check inside per-article loop — bail if global limit exceeded
        if crawl_start and max_crawl_time:
            if time.time() - crawl_start > max_crawl_time:
                print(f"    ⚠ Time limit hit during article processing — got {len(articles)}/{len(raw_articles)} articles")
                break

        article_url = raw.get("url", "")
        if not article_url:
            continue

        # ---- Timestamp normalization via freshness module ----
        # Both feed_parser and html_scraper return (iso_string, confidence)
        # tuples, or (None, "unknown") when no date was found.
        raw_published = raw.get("published")
        if isinstance(raw_published, tuple):
            pub_raw_str = raw_published[0]  # may be None
        elif raw_published is None:
            pub_raw_str = None
        else:
            pub_raw_str = raw_published

        observed_at = datetime.now(timezone.utc)
        freshness = normalize_article_timestamp(pub_raw_str, observed_at)

        intro = fetch_intro(
            article_url,
            rss_summary=raw.get("summary", ""),
            preview_mode=preview_mode,
        )
        # Defense-in-depth: final 300-char safety cap (CONTENT-POLICY §1.3)
        intro = (intro or "")[:300]

        articles.append({
            "id": make_article_id(article_url),
            "title": raw.get("title", "").strip(),
            "url": article_url.strip(),
            "intro": intro,
            "source": name,
            "section": source.get("section", "misc"),
            "subsections": _compute_subsections(
                source.get("subsections", []),
                raw.get("extra_subsections", []),
                source.get("section", "misc"),
                source_type,
                freshness["age_hours"],
            ),
            "tier": source.get("tier", "free"),
            # Freshness fields (all computed by freshness module)
            "published": freshness["published"],
            "published_at": freshness["published_at"],
            "published_raw": freshness["published_raw"],
            "published_confidence": freshness["published_confidence"],
            "timestamp_issue": freshness["timestamp_issue"],
            "observed_at": freshness["observed_at"],
            "age_hours": freshness["age_hours"],
            "freshness_bucket": freshness["freshness_bucket"],
            "freshness_bucket_order": freshness["freshness_bucket_order"],
            "freshness_score": freshness["freshness_score"],
            # Legacy field for frontend backward compatibility
            # Maps: high→exact, medium→estimated, low→unknown
            "date_confidence": {
                "high": "exact",
                "medium": "estimated",
                "low": "unknown",
            }.get(freshness["published_confidence"], "unknown"),
        })

    print(f"    Got {len(articles)} articles")
    return articles, "ok" if articles else "empty"


def _parse_max_age() -> float:
    """Parse MAX_AGE_HOURS from env, defaulting to 168 (1 week)."""
    raw = os.environ.get("MAX_AGE_HOURS", "168")
    try:
        value = float(raw)
        if value <= 0:
            return 168.0
        return value
    except ValueError:
        return 168.0


def _atomic_write_json(path: Path, data: dict) -> None:
    """Write JSON atomically via temp file + rename."""
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_path = tempfile.mkstemp(
        dir=path.parent, prefix=".tmp_", suffix=".json"
    )
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        os.replace(tmp_path, path)
    except BaseException:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        raise


def main() -> None:
    """Main crawl pipeline with resilient per-source error handling."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    crawl_start = time.time()

    print("=" * 60)
    print(_CRAWLER_NAME)
    print(f"Started: {datetime.now(timezone.utc).isoformat()}")
    print(f"Max crawl time: {MAX_CRAWL_TIME}s")
    print("=" * 60)

    config = load_config()
    sources = config.get("sources", [])
    sections_meta = config.get("sections_metadata", {})
    subsections_meta = config.get("subsections_metadata", {})

    print(f"\nLoaded {len(sources)} sources\n")

    all_articles: list[dict] = []
    source_health: list[dict] = []
    time_exceeded = False

    for i, source in enumerate(sources):
        source_name = source.get("name", f"Source {i}")
        source_url = source.get("url", "")

        # ---- Check time BEFORE this source ----
        elapsed = time.time() - crawl_start
        if elapsed > MAX_CRAWL_TIME:
            for remaining in sources[i:]:
                source_health.append({
                    "name": remaining.get("name", ""),
                    "url": remaining.get("url", ""),
                    "status": "skipped",
                    "reason": "Crawl time limit exceeded",
                    "articles": 0,
                    "duration_ms": 0,
                })
            print(f"\n⚠ Max crawl time ({MAX_CRAWL_TIME}s) exceeded after {elapsed:.0f}s.")
            print(f"  Stopping with {len(all_articles)} articles from {i}/{len(sources)} sources.")
            time_exceeded = True
            break

        # ---- Skip disabled sources ----
        if source.get("enabled") is False:
            print(f"  [skip] {source_name}: disabled")
            source_health.append({
                "name": source_name,
                "url": source_url,
                "status": "disabled",
                "reason": "Manually disabled",
                "articles": 0,
                "duration_ms": 0,
            })
            continue

        # ---- RESILIENT CRAWL: wrap EVERY source in try/except ----
        source_start = time.time()
        try:
            articles, status = crawl_source(source, crawl_start=crawl_start, max_crawl_time=MAX_CRAWL_TIME)
            source_duration = (time.time() - source_start) * 1000

            all_articles.extend(articles)

            # Classify health status
            if articles:
                health_status = "slow" if source_duration > 10000 else "healthy"
            else:
                health_status = "empty"

            source_health.append({
                "name": source_name,
                "url": source_url,
                "status": health_status,
                "articles": len(articles),
                "duration_ms": round(source_duration),
            })

        except requests.exceptions.HTTPError as e:
            source_duration = (time.time() - source_start) * 1000
            reason = f"{e.response.status_code} {e.response.reason}" if e.response else str(e)
            print(f"    SKIP: {reason} — {source_url}")
            source_health.append({
                "name": source_name,
                "url": source_url,
                "status": "error",
                "reason": reason[:200],
                "articles": 0,
                "duration_ms": round(source_duration),
            })

        except (TimeoutError, Exception) as e:
            source_duration = (time.time() - source_start) * 1000
            error_msg = str(e)[:200]
            is_timeout = "timeout" in error_msg.lower() or isinstance(e, TimeoutError)
            print(f"    {'TIMEOUT' if is_timeout else 'ERROR'}: {source_name} — {error_msg}")
            source_health.append({
                "name": source_name,
                "url": source_url,
                "status": "timeout" if is_timeout else "error",
                "reason": error_msg,
                "articles": 0,
                "duration_ms": round(source_duration),
            })

        # ---- Check time AFTER this source ----
        elapsed = time.time() - crawl_start
        if elapsed > MAX_CRAWL_TIME:
            for remaining in sources[i + 1:]:
                source_health.append({
                    "name": remaining.get("name", ""),
                    "url": remaining.get("url", ""),
                    "status": "skipped",
                    "reason": "Crawl time limit exceeded",
                    "articles": 0,
                    "duration_ms": 0,
                })
            print(f"\n⚠ Max crawl time ({MAX_CRAWL_TIME}s) exceeded after {elapsed:.0f}s.")
            print(f"  Stopping with {len(all_articles)} articles from {i + 1}/{len(sources)} sources.")
            time_exceeded = True
            break

    # ---- Post-processing (ALWAYS runs, even if time exceeded) ----
    print(f"\nTotal raw articles: {len(all_articles)}")

    all_articles = deduplicate_articles(all_articles)
    print(f"After dedup: {len(all_articles)}")

    max_age = _parse_max_age()
    all_articles = [a for a in all_articles if a["age_hours"] <= max_age]
    print(f"After age filter ({max_age}h): {len(all_articles)}")

    # Sort by freshness: bucket → confidence → recency (newest first)
    all_articles.sort(key=freshness_sort_key)

    # ---- Write articles.json (ALWAYS) ----
    output = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "crawler": _CRAWLER_NAME,
        "article_count": len(all_articles),
        "sections_metadata": sections_meta,
        "subsections_metadata": subsections_meta,
        "source_health": source_health,
        "articles": all_articles,
    }

    output_path = DATA_DIR / "articles.json"
    _atomic_write_json(output_path, output)

    # ---- Write source_health.json ----
    crawl_duration = time.time() - crawl_start
    health_data = {
        "crawl_timestamp": datetime.now(timezone.utc).isoformat(),
        "crawl_duration_s": round(crawl_duration),
        "total_sources": len(sources),
        "sources_crawled": sum(1 for s in source_health if s["status"] in ("healthy", "slow", "empty")),
        "sources_failed": sum(1 for s in source_health if s["status"] in ("error", "timeout")),
        "sources_skipped": sum(1 for s in source_health if s["status"] in ("disabled", "skipped")),
        "total_articles": len(all_articles),
        "sources": source_health,
    }

    health_path = DATA_DIR / "source_health.json"
    _atomic_write_json(health_path, health_data)

    # ---- Summary ----
    print(f"\nWrote {len(all_articles)} articles to {output_path}")
    print(f"File size: {output_path.stat().st_size / 1024:.1f} KB")
    print(f"Source health: {health_data['sources_crawled']} healthy, "
          f"{health_data['sources_failed']} failed, "
          f"{health_data['sources_skipped']} skipped")
    print(f"Total crawl time: {crawl_duration:.1f}s")
    if time_exceeded:
        print("⚠ Crawl was stopped early due to time limit.")
    print("=" * 60)


if __name__ == "__main__":
    main()
