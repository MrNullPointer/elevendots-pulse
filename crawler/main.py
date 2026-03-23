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
from datetime import datetime, timezone
from pathlib import Path

import yaml

from .deduplicator import deduplicate_articles
from .feed_parser import parse_rss_feed
from .html_scraper import scrape_html_source
from .intro_fetcher import fetch_intro
from .robots_checker import is_crawling_allowed
from .utils import compute_age_hours, make_article_id

logger = logging.getLogger(__name__)

ROOT = Path(__file__).resolve().parent.parent
CONFIG_DIR = ROOT / "config"
DATA_DIR = ROOT / "data"

_CRAWLER_NAME = "Elevendots-Pulse Crawler"


def load_config() -> dict:
    """Load sources.yaml safely."""
    config_path = CONFIG_DIR / "sources.yaml"
    with open(config_path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def crawl_source(source: dict) -> tuple[list[dict], str]:
    """Crawl a single source. Returns (articles, status)."""
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

    try:
        if source_type in ("rss", "atom"):
            raw_articles = parse_rss_feed(url)
        elif source_type == "html":
            selectors = source.get("selectors", {})
            raw_articles = scrape_html_source(url, selectors)
        else:
            print(f"    Unknown type: {source_type}")
            return [], "error"

        articles = []
        for raw in raw_articles:
            article_url = raw.get("url", "")
            if not article_url:
                continue

            published = raw.get(
                "published", datetime.now(timezone.utc).isoformat()
            )
            age_hours = compute_age_hours(published)

            intro = fetch_intro(
                article_url,
                rss_summary=raw.get("summary", ""),
                preview_mode=preview_mode,
            )

            articles.append({
                "id": make_article_id(article_url),
                "title": raw.get("title", "").strip(),
                "url": article_url.strip(),
                "intro": intro,
                "source": name,
                "section": source.get("section", "misc"),
                "subsections": source.get("subsections", []),
                "tier": source.get("tier", "free"),
                "published": published,
                "age_hours": age_hours,
            })

        status = "ok" if articles else "empty"
        print(f"    Got {len(articles)} articles")
        return articles, status

    except Exception as e:
        logger.exception("Error crawling %s", name)
        print(f"    ERROR: {e}")
        return [], "error"


def _parse_max_age() -> float:
    """Parse MAX_AGE_HOURS from env, defaulting to 72."""
    raw = os.environ.get("MAX_AGE_HOURS", "72")
    try:
        value = float(raw)
        if value <= 0:
            logger.warning("MAX_AGE_HOURS must be positive, using 72")
            return 72.0
        return value
    except ValueError:
        logger.warning("Invalid MAX_AGE_HOURS=%r, using 72", raw)
        return 72.0


def _atomic_write_json(path: Path, data: dict) -> None:
    """
    Write JSON to a file atomically.

    Writes to a temp file in the same directory, then renames.
    Prevents corrupted output if the process crashes mid-write.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_path = tempfile.mkstemp(
        dir=path.parent, prefix=".articles_", suffix=".json"
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
    """Main crawl pipeline."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    print("=" * 60)
    print(_CRAWLER_NAME)
    print(f"Started: {datetime.now(timezone.utc).isoformat()}")
    print("=" * 60)

    config = load_config()
    sources = config.get("sources", [])
    sections_meta = config.get("sections_metadata", {})
    subsections_meta = config.get("subsections_metadata", {})

    print(f"\nLoaded {len(sources)} sources\n")

    all_articles: list[dict] = []
    source_health: list[dict] = []

    for source in sources:
        articles, status = crawl_source(source)
        all_articles.extend(articles)
        source_health.append({
            "name": source.get("name", ""),
            "url": source.get("url", ""),
            "section": source.get("section", ""),
            "articles_found": len(articles),
            "last_crawled": datetime.now(timezone.utc).isoformat(),
            "status": status,
        })

    print(f"\nTotal raw articles: {len(all_articles)}")

    # Deduplicate
    all_articles = deduplicate_articles(all_articles)
    print(f"After dedup: {len(all_articles)}")

    # Filter by age
    max_age = _parse_max_age()
    all_articles = [a for a in all_articles if a["age_hours"] <= max_age]
    print(f"After age filter ({max_age}h): {len(all_articles)}")

    # Sort by recency
    all_articles.sort(key=lambda a: a["age_hours"])

    # Write output atomically
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

    print(f"\nWrote {len(all_articles)} articles to {output_path}")
    print(f"File size: {output_path.stat().st_size / 1024:.1f} KB")
    print("=" * 60)


if __name__ == "__main__":
    main()
