"""Tests for Pulse mobile feed JSON schemas and validation script."""

import json
import subprocess
import sys
import tempfile
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator, FormatChecker

ROOT = Path(__file__).resolve().parent.parent
SCHEMAS_DIR = ROOT / "schemas"
FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"


def load_json(path: Path) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def load_schema(name: str) -> dict:
    return load_json(SCHEMAS_DIR / name)


def validate(data: dict, schema: dict) -> list[str]:
    validator = Draft202012Validator(schema, format_checker=FormatChecker())
    return [e.message for e in validator.iter_errors(data)]


# --- Schema syntax validity ---

@pytest.mark.parametrize("schema_file", [
    "manifest.schema.json",
    "home.schema.json",
    "section.schema.json",
    "search-index.schema.json",
    "changes.schema.json",
    "notification-payload.schema.json",
])
def test_schema_is_valid_json_schema(schema_file):
    schema = load_schema(schema_file)
    Draft202012Validator.check_schema(schema)


# --- Valid fixtures pass ---

def test_valid_manifest():
    schema = load_schema("manifest.schema.json")
    data = load_json(FIXTURES_DIR / "valid_manifest.json")
    assert validate(data, schema) == []


def test_valid_home():
    schema = load_schema("home.schema.json")
    data = load_json(FIXTURES_DIR / "valid_home.json")
    assert validate(data, schema) == []


def test_valid_section_tech():
    schema = load_schema("section.schema.json")
    data = load_json(FIXTURES_DIR / "valid_section_tech.json")
    assert validate(data, schema) == []


def test_valid_search_index():
    schema = load_schema("search-index.schema.json")
    data = load_json(FIXTURES_DIR / "valid_search_index.json")
    assert validate(data, schema) == []


def test_valid_changes():
    schema = load_schema("changes.schema.json")
    data = load_json(FIXTURES_DIR / "valid_changes.json")
    assert validate(data, schema) == []


# --- Invalid fixtures fail with correct errors ---

def test_invalid_manifest_missing_fields():
    schema = load_schema("manifest.schema.json")
    data = load_json(FIXTURES_DIR / "invalid_manifest_missing_fields.json")
    errors = validate(data, schema)
    assert len(errors) > 0
    error_text = " ".join(errors)
    for field in ["generated_at", "min_supported_app_version", "sections", "indexes", "total_articles", "crawler_version"]:
        assert field in error_text, f"Expected error about missing '{field}'"


def test_invalid_article_bad_id():
    schema = load_schema("home.schema.json")
    data = load_json(FIXTURES_DIR / "invalid_article_bad_id.json")
    errors = validate(data, schema)
    assert len(errors) > 0
    assert any("TECH_BAD-ID!!" in e or "pattern" in e.lower() for e in errors)


def test_invalid_section_wrong_enum():
    schema = load_schema("section.schema.json")
    data = load_json(FIXTURES_DIR / "invalid_section_wrong_enum.json")
    errors = validate(data, schema)
    assert len(errors) > 0
    assert any("sports" in e or "enum" in e.lower() for e in errors)


# --- Edge cases ---

def test_empty_articles_array():
    schema = load_schema("home.schema.json")
    data = {"generated_at": "2026-03-26T14:07:00Z", "articles": []}
    assert validate(data, schema) == []


def test_zero_counts_in_manifest():
    schema = load_schema("manifest.schema.json")
    data = load_json(FIXTURES_DIR / "valid_manifest.json")
    for section in data["sections"].values():
        section["count"] = 0
    data["total_articles"] = 0
    assert validate(data, schema) == []


def test_empty_changes():
    schema = load_schema("changes.schema.json")
    data = {
        "generated_at": "2026-03-26T14:07:00Z",
        "build_id": "2026-03-26T14:07:00Z",
        "previous_build_id": "",
        "new_articles": [],
        "removed_article_ids": [],
        "updated_article_ids": [],
        "section_changes": {
            "tech": {"added": 0, "removed": 0},
            "science": {"added": 0, "removed": 0},
            "philosophy": {"added": 0, "removed": 0},
            "world": {"added": 0, "removed": 0},
            "research": {"added": 0, "removed": 0},
            "misc": {"added": 0, "removed": 0}
        }
    }
    assert validate(data, schema) == []


def test_empty_keywords_array():
    schema = load_schema("search-index.schema.json")
    data = {
        "generated_at": "2026-03-26T14:07:00Z",
        "items": [{
            "id": "tech-a3f8c2d1e4f7",
            "title": "Test",
            "source": "Test",
            "section": "tech",
            "subsection": "test",
            "published": "2026-03-26T12:00:00Z",
            "keywords": [],
            "url": "https://test.com/article"
        }]
    }
    assert validate(data, schema) == []


def test_article_tier_out_of_range():
    schema = load_schema("home.schema.json")
    data = load_json(FIXTURES_DIR / "valid_home.json")
    data["articles"][0]["tier"] = 5
    errors = validate(data, schema)
    assert len(errors) > 0


def test_negative_freshness_score():
    schema = load_schema("home.schema.json")
    data = load_json(FIXTURES_DIR / "valid_home.json")
    data["articles"][0]["freshness_score"] = -1
    errors = validate(data, schema)
    assert len(errors) > 0


def test_notification_payload_valid():
    schema = load_schema("notification-payload.schema.json")
    data = {
        "type": "section_update",
        "title": "5 new tech articles",
        "body": "Including: TSMC Begins 1.4nm Risk Production",
        "data": {
            "section": "tech",
            "deeplink": "pulse://section/tech"
        }
    }
    assert validate(data, schema) == []


def test_notification_payload_with_article_id():
    schema = load_schema("notification-payload.schema.json")
    data = {
        "type": "must_read",
        "title": "Must Read",
        "body": "TSMC Begins 1.4nm Risk Production",
        "data": {
            "section": "tech",
            "article_id": "tech-a3f8c2d1e4f7",
            "deeplink": "pulse://article/tech-a3f8c2d1e4f7"
        }
    }
    assert validate(data, schema) == []


def test_notification_payload_invalid_type():
    schema = load_schema("notification-payload.schema.json")
    data = {
        "type": "breaking_news",
        "title": "Test",
        "body": "Test",
        "data": {"section": "tech", "deeplink": "pulse://home"}
    }
    errors = validate(data, schema)
    assert len(errors) > 0


# --- End-to-end validation script test ---

def test_validate_script_passes_on_valid_feed():
    with tempfile.TemporaryDirectory() as tmpdir:
        feed_dir = Path(tmpdir) / "mobile"
        sections_dir = feed_dir / "sections"
        sections_dir.mkdir(parents=True)

        # Copy valid fixtures as feed files
        fixtures = {
            "manifest.json": "valid_manifest.json",
            "home.json": "valid_home.json",
            "search-index.json": "valid_search_index.json",
            "changes.json": "valid_changes.json",
        }
        for feed_name, fixture_name in fixtures.items():
            data = load_json(FIXTURES_DIR / fixture_name)
            with open(feed_dir / feed_name, "w") as f:
                json.dump(data, f)

        # Create section files from valid_section_tech.json
        section_data = load_json(FIXTURES_DIR / "valid_section_tech.json")
        for section in ["tech", "science", "philosophy", "world", "research", "misc"]:
            with open(sections_dir / f"{section}.json", "w") as f:
                json.dump(section_data, f)

        result = subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "validate_mobile_feed.py"),
             "--schemas", str(SCHEMAS_DIR), "--feed", str(feed_dir)],
            capture_output=True, text=True,
        )
        assert result.returncode == 0, f"stdout: {result.stdout}\nstderr: {result.stderr}"
        assert "FAIL" not in result.stdout


def test_validate_script_fails_on_invalid_feed():
    with tempfile.TemporaryDirectory() as tmpdir:
        feed_dir = Path(tmpdir) / "mobile"
        feed_dir.mkdir(parents=True)

        # Write an invalid manifest
        with open(feed_dir / "manifest.json", "w") as f:
            json.dump({"feed_schema_version": 1}, f)

        result = subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "validate_mobile_feed.py"),
             "--schemas", str(SCHEMAS_DIR), "--feed", str(feed_dir)],
            capture_output=True, text=True,
        )
        assert result.returncode == 1
        assert "FAIL" in result.stdout
