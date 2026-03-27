#!/usr/bin/env python3
"""Validate Pulse mobile feed files against JSON schemas.

Usage:
    python scripts/validate_mobile_feed.py --schemas schemas/ --feed site/public/mobile/
"""

import argparse
import json
import sys
from pathlib import Path

import jsonschema
from jsonschema import Draft202012Validator, FormatChecker


FEED_SCHEMA_MAP = {
    "manifest.json": "manifest.schema.json",
    "home.json": "home.schema.json",
    "search-index.json": "search-index.schema.json",
    "changes.json": "changes.schema.json",
    "sections/tech.json": "section.schema.json",
    "sections/science.json": "section.schema.json",
    "sections/philosophy.json": "section.schema.json",
    "sections/world.json": "section.schema.json",
    "sections/research.json": "section.schema.json",
    "sections/misc.json": "section.schema.json",
}


def load_json(path: Path) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def validate_file(feed_path: Path, schema: dict) -> list[str]:
    """Validate a single feed file against a schema. Returns list of error messages."""
    errors: list[str] = []
    try:
        data = load_json(feed_path)
    except FileNotFoundError:
        return [f"File not found: {feed_path}"]
    except json.JSONDecodeError as e:
        return [f"Invalid JSON in {feed_path}: {e}"]

    validator = Draft202012Validator(schema, format_checker=FormatChecker())
    for error in sorted(validator.iter_errors(data), key=lambda e: list(e.path)):
        path_str = ".".join(str(p) for p in error.absolute_path) or "(root)"
        errors.append(f"  {path_str}: {error.message}")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate Pulse mobile feed against JSON schemas")
    parser.add_argument("--schemas", required=True, help="Path to schemas directory")
    parser.add_argument("--feed", required=True, help="Path to mobile feed directory")
    args = parser.parse_args()

    schemas_dir = Path(args.schemas)
    feed_dir = Path(args.feed)

    all_passed = True

    for feed_file, schema_file in FEED_SCHEMA_MAP.items():
        feed_path = feed_dir / feed_file
        schema_path = schemas_dir / schema_file

        if not schema_path.exists():
            print(f"FAIL  {feed_file} — schema not found: {schema_path}")
            all_passed = False
            continue

        if not feed_path.exists():
            print(f"FAIL  {feed_file} — feed file not found: {feed_path}")
            all_passed = False
            continue

        schema = load_json(schema_path)
        errors = validate_file(feed_path, schema)

        if errors:
            print(f"FAIL  {feed_file}")
            for err in errors:
                print(err)
            all_passed = False
        else:
            print(f"PASS  {feed_file}")

    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())
