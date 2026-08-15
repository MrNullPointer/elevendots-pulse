#!/usr/bin/env python3
"""
End-to-end freshness alarm for the crawl → commit → deploy pipeline.

Why this exists: on 2026-08-06 run #2709 parked in `waiting` on the
github-pages environment gate and held the workflow's concurrency group.
Every hourly run for the next 9 days was queued and then cancelled by its
successor. Nothing ever went red, because a *cancelled* run is not a *failed*
run and GitHub only notifies on failure. The site sat frozen and the only
symptom was silence.

This script is the missing alarm. It checks the two things that actually
matter and fails loudly when either stops being true:

  1. data/articles.json on main is fresh   -> the crawl half is alive
  2. the published site's articles.json is fresh -> the deploy half is alive

Check 2 is the important one: the crawl can keep committing perfectly good
data to main while deploys silently park forever, which looks healthy from
inside the repo and completely dead to every actual reader.

Exits non-zero on staleness so the workflow goes red and GitHub sends mail.

Usage: python scripts/check_freshness.py
Env:   MAX_AGE_HOURS (default 6), SITE_URL (default https://pulse.elevendots.dev)
"""

import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

MAX_AGE_HOURS = float(os.environ.get("MAX_AGE_HOURS", 6))
SITE_URL = os.environ.get("SITE_URL", "https://pulse.elevendots.dev").rstrip("/")
LOCAL_FEED = Path("data/articles.json")
FETCH_RETRIES = 3
FETCH_TIMEOUT = 20


def age_hours(generated_at: str) -> float:
    """Hours between an ISO-8601 `generated_at` and now (UTC)."""
    stamp = datetime.fromisoformat(generated_at)
    if stamp.tzinfo is None:
        stamp = stamp.replace(tzinfo=timezone.utc)
    return (datetime.now(timezone.utc) - stamp).total_seconds() / 3600


def read_local() -> tuple[str, int]:
    data = json.loads(LOCAL_FEED.read_text())
    return data["generated_at"], data.get("article_count", 0)


def read_live() -> tuple[str, int]:
    """Fetch the published feed. Retries so a blip is not an alarm."""
    url = f"{SITE_URL}/articles.json"
    last_error = None
    for attempt in range(1, FETCH_RETRIES + 1):
        try:
            req = urllib.request.Request(
                url, headers={"User-Agent": "elevendots-pulse-freshness-check"}
            )
            with urllib.request.urlopen(req, timeout=FETCH_TIMEOUT) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            return data["generated_at"], data.get("article_count", 0)
        except (urllib.error.URLError, ValueError, KeyError, TimeoutError) as e:
            last_error = e
            if attempt < FETCH_RETRIES:
                time.sleep(2**attempt)
    raise RuntimeError(f"could not read {url} after {FETCH_RETRIES} tries: {last_error}")


def main() -> int:
    failures = []

    # ---- 1. Did the crawl commit fresh data to main? ----
    try:
        generated_at, count = read_local()
        hours = age_hours(generated_at)
        print(f"repo  data/articles.json : {generated_at} ({hours:.1f}h old, {count} articles)")
        if hours > MAX_AGE_HOURS:
            failures.append(
                f"CRAWL STALLED — committed data is {hours:.1f}h old (limit {MAX_AGE_HOURS}h).\n"
                f"    The crawl job is not committing. Check for cancelled runs: a run wedged\n"
                f"    on a concurrency group starves the schedule without ever going red."
            )
    except Exception as e:
        failures.append(f"could not read {LOCAL_FEED}: {e}")

    # ---- 2. Did that data actually reach readers? ----
    try:
        generated_at, count = read_live()
        hours = age_hours(generated_at)
        print(f"live  {SITE_URL}/articles.json : {generated_at} ({hours:.1f}h old, {count} articles)")
        if hours > MAX_AGE_HOURS:
            failures.append(
                f"DEPLOY STALLED — the published site is {hours:.1f}h old (limit {MAX_AGE_HOURS}h).\n"
                f"    Fresh data may be committing to main while deploys never land. The usual\n"
                f"    cause is the deploy job parking in `waiting` on the github-pages\n"
                f"    environment gate: Settings -> Environments -> github-pages."
            )
    except Exception as e:
        failures.append(f"could not read the published feed: {e}")

    if failures:
        print("\n" + "=" * 68)
        print("FRESHNESS ALARM")
        print("=" * 68)
        for f in failures:
            print(f"  - {f}")
        return 1

    print(f"\nOK: both the repo and the live site are within {MAX_AGE_HOURS}h.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
