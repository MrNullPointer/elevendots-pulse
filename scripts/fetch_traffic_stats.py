#!/usr/bin/env python3
"""
Fetch GitHub Pages traffic stats via the GitHub API.

Uses the GITHUB_TOKEN available in GitHub Actions.
Writes stats.json to site/public/ for the frontend to display.

Privacy: This uses data GitHub already collects for GitHub Pages.
No new tracking is added. No cookies, no scripts, no third-party.

Usage: python scripts/fetch_traffic_stats.py
"""

import json
import os
import subprocess
from datetime import datetime, timezone
from pathlib import Path


def fetch_traffic():
    """Fetch traffic data using the gh CLI."""
    try:
        result = subprocess.run(
            ["gh", "api", "/repos/MrNullPointer/elevendots-pulse/traffic/views"],
            capture_output=True, text=True, timeout=15,
        )
        if result.returncode != 0:
            print(f"  Warning: GitHub API returned error: {result.stderr.strip()}")
            return None
        return json.loads(result.stdout)
    except (subprocess.TimeoutExpired, FileNotFoundError, json.JSONDecodeError) as e:
        print(f"  Warning: Could not fetch traffic stats: {e}")
        return None


def main():
    print("Fetching GitHub Pages traffic stats...")

    traffic = fetch_traffic()

    if traffic:
        total_views = traffic.get("count", 0)
        unique_visitors = traffic.get("uniques", 0)
        # Get today's views from the daily breakdown
        daily = traffic.get("views", [])
        today_views = daily[-1].get("count", 0) if daily else 0
    else:
        # Fallback: use existing stats if API fails
        existing_path = Path("site/public/stats.json")
        if existing_path.exists():
            with open(existing_path) as f:
                existing = json.load(f)
            total_views = existing.get("total_views", 0)
            unique_visitors = existing.get("unique_visitors", 0)
            today_views = 0
            print("  Using cached stats (API unavailable)")
        else:
            total_views = 0
            unique_visitors = 0
            today_views = 0
            print("  No stats available")

    stats = {
        "total_views": total_views,
        "unique_visitors": unique_visitors,
        "today_views": today_views,
        "period": "last_14_days",
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    out_path = Path("site/public/stats.json")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w") as f:
        json.dump(stats, f, indent=2)

    print(f"  Total views (14d): {total_views}")
    print(f"  Unique visitors: {unique_visitors}")
    print(f"  Written to {out_path}")


if __name__ == "__main__":
    main()
