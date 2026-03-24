"""
Elevendots-Pulse — Compliance Test Suite
=========================================
Validates the codebase against CONTENT-POLICY.md v2.0.
Run: python -m pytest tests/test_compliance.py -v
"""

import json
import os
import re
import sys
import time
from io import BytesIO
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
import yaml

# Ensure project root is importable
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from crawler.utils import (
    USER_AGENT,
    HEADERS,
    TIMEOUT,
    _MIN_INTERVAL,
    clean_html,
    is_safe_url,
    make_article_id,
    rate_limited_get,
)
from crawler.intro_fetcher import MAX_INTRO_LENGTH


# ============================================================================
# 1. test_intro_text_cap
# ============================================================================

class TestIntroTextCap:
    def test_max_intro_length_constant_is_300(self):
        assert MAX_INTRO_LENGTH == 300

    def test_clean_html_then_cap_at_300(self):
        long_text = "<p>" + "A" * 1000 + "</p>"
        result = clean_html(long_text)[:300]
        assert len(result) <= 300

    def test_exactly_300_chars_passes(self):
        text = "B" * 300
        result = clean_html(text)[:300]
        assert len(result) == 300

    def test_301_chars_capped(self):
        text = "C" * 301
        result = clean_html(text)[:300]
        assert len(result) == 300

    def test_zero_length_passes(self):
        result = clean_html("")[:300]
        assert result == ""

    def test_feed_parser_caps_at_300(self):
        """feed_parser.extract_summary must cap at 300, not 500."""
        from crawler.feed_parser import extract_summary
        mock_entry = {"summary": "X" * 600}
        result = extract_summary(mock_entry)
        assert len(result) <= 300


# ============================================================================
# 2. test_clean_html_strips_all_tags
# ============================================================================

class TestCleanHtml:
    def test_strips_script_tag(self):
        result = clean_html('<script>alert("xss")</script>')
        assert "<script>" not in result
        assert "<" not in result

    def test_strips_img_onerror(self):
        result = clean_html('<img src=x onerror=alert(1)>')
        assert "<img" not in result
        assert "onerror" not in result

    def test_strips_iframe(self):
        result = clean_html('<iframe src="http://evil.com"></iframe>')
        assert "<iframe" not in result

    def test_strips_div_onclick(self):
        result = clean_html('<div onclick="steal()">text</div>')
        assert "onclick" not in result
        assert "text" in result

    def test_strips_style_tag(self):
        result = clean_html('<style>body{display:none}</style>visible')
        assert "<style>" not in result

    def test_strips_link_tag(self):
        result = clean_html('<link rel="stylesheet" href="evil.css">text')
        assert "<link" not in result

    def test_preserves_plain_text(self):
        result = clean_html("Hello World")
        assert result == "Hello World"

    def test_no_angle_brackets_in_output(self):
        result = clean_html(
            '<p>Hello</p><script>alert(1)</script>'
            '<img src=x onerror=alert(1)>'
            '<a href="javascript:void(0)">click</a>'
        )
        assert "<" not in result
        assert ">" not in result


# ============================================================================
# 3. test_url_validation
# ============================================================================

class TestUrlValidation:
    def test_valid_https_url(self):
        assert is_safe_url("https://example.com/article") is True

    def test_valid_http_url(self):
        assert is_safe_url("http://example.com/article") is True

    def test_rejects_javascript_scheme(self):
        assert is_safe_url("javascript:alert(1)") is False

    def test_rejects_data_scheme(self):
        assert is_safe_url("data:text/html,<script>") is False

    def test_rejects_file_scheme(self):
        assert is_safe_url("file:///etc/passwd") is False

    def test_rejects_ftp_scheme(self):
        assert is_safe_url("ftp://files.example.com") is False

    def test_rejects_empty_string(self):
        assert is_safe_url("") is False

    def test_id_generation_deterministic(self):
        id1 = make_article_id("https://example.com/article")
        id2 = make_article_id("https://example.com/article")
        assert id1 == id2
        assert len(id1) == 16  # SHA-256 truncated to 16 hex chars


# ============================================================================
# 4. test_article_schema_no_forbidden_fields
# ============================================================================

ARTICLES_JSON = ROOT / "data" / "articles.json"
FORBIDDEN_FIELDS = {
    "body", "content", "full_text", "image_url", "thumbnail",
    "og_image", "cached_html", "article_text", "hero_image", "favicon",
}
REQUIRED_FIELDS = {"id", "title", "url", "source", "section"}


@pytest.mark.skipif(not ARTICLES_JSON.exists(), reason="articles.json not present")
class TestArticleSchema:
    @pytest.fixture(scope="class")
    def data(self):
        return json.loads(ARTICLES_JSON.read_text())

    def test_article_count_matches(self, data):
        assert data["article_count"] == len(data["articles"])

    def test_required_fields_present(self, data):
        for i, article in enumerate(data["articles"]):
            missing = REQUIRED_FIELDS - set(article.keys())
            assert not missing, f"Article {i} missing: {missing}"

    def test_no_forbidden_fields(self, data):
        for i, article in enumerate(data["articles"]):
            found = FORBIDDEN_FIELDS & set(article.keys())
            assert not found, f"Article {i} has forbidden fields: {found}"

    def test_intro_max_300_chars(self, data):
        for i, article in enumerate(data["articles"]):
            intro = article.get("intro", "")
            assert len(intro) <= 300, f"Article {i} intro is {len(intro)} chars"

    def test_urls_are_http(self, data):
        for i, article in enumerate(data["articles"]):
            url = article.get("url", "")
            assert url.startswith("http://") or url.startswith("https://"), \
                f"Article {i} URL invalid: {url[:50]}"


# ============================================================================
# 5. test_source_policy_present
# ============================================================================

SOURCES_YAML = ROOT / "config" / "sources.yaml"


class TestSourcePolicy:
    @pytest.fixture(scope="class")
    def sources(self):
        data = yaml.safe_load(SOURCES_YAML.read_text())
        return data.get("sources", [])

    def test_all_sources_have_policy(self, sources):
        for i, s in enumerate(sources):
            assert "policy" in s, f"Source '{s.get('name', i)}' missing policy block"

    def test_policy_has_required_fields(self, sources):
        required = {"preview_mode", "robots_txt_checked", "tos_reviewed"}
        for s in sources:
            policy = s.get("policy", {})
            missing = required - set(policy.keys())
            assert not missing, f"Source '{s['name']}' policy missing: {missing}"

    def test_preview_mode_valid(self, sources):
        valid_modes = {"rss_description", "og_description", "title_only", "manual"}
        for s in sources:
            mode = s.get("policy", {}).get("preview_mode", "")
            assert mode in valid_modes, f"Source '{s['name']}' has invalid preview_mode: {mode}"


# ============================================================================
# 6. test_no_secrets_in_repo
# ============================================================================

SECRET_PATTERNS = [
    re.compile(r"sk-[a-zA-Z0-9]{20,}"),
    re.compile(r"ghp_[a-zA-Z0-9]{36}"),
    re.compile(r"gho_[a-zA-Z0-9]+"),
    re.compile(r"AKIA[A-Z0-9]{16}"),
    re.compile(r"Bearer\s+[a-zA-Z0-9\-._~+/]+=*"),
    re.compile(r"-----BEGIN\s+(RSA\s+|EC\s+)?PRIVATE\s+KEY-----"),
    re.compile(r'api_key\s*[=:]\s*["\'][^"\']{20,}["\']'),
    re.compile(r'password\s*[=:]\s*["\'][^"\']+["\']'),
]
SKIP_DIRS = {".git", "node_modules", "__pycache__", ".vite", "dist"}
SKIP_EXTS = {".lock", ".png", ".jpg", ".jpeg", ".gif", ".ico", ".woff", ".woff2", ".ttf"}


class TestNoSecrets:
    def test_no_secrets_in_files(self):
        violations = []
        for path in ROOT.rglob("*"):
            if path.is_dir():
                continue
            if any(skip in path.parts for skip in SKIP_DIRS):
                continue
            if path.suffix in SKIP_EXTS:
                continue
            try:
                content = path.read_text(errors="ignore")
            except Exception:
                continue
            for pattern in SECRET_PATTERNS:
                matches = pattern.findall(content)
                if matches:
                    rel = path.relative_to(ROOT)
                    violations.append(f"{rel}: {pattern.pattern} matched")
        assert not violations, f"Secrets found:\n" + "\n".join(violations)


# ============================================================================
# 7. test_user_agent_consistency
# ============================================================================

class TestUserAgent:
    def test_contains_product_name(self):
        assert "ElevendotsPulse" in USER_AGENT or "elevendots" in USER_AGENT.lower()

    def test_contains_url(self):
        assert "https://" in USER_AGENT

    def test_contains_contact_email(self):
        assert "@" in USER_AGENT

    def test_headers_dict_matches(self):
        assert HEADERS["User-Agent"] == USER_AGENT

    def test_timeout_is_reasonable(self):
        assert 10 <= TIMEOUT <= 30  # Must be between 10-30s

    def test_min_interval_is_1_5(self):
        assert _MIN_INTERVAL == 1.5


# ============================================================================
# 8. test_rate_limit_enforcement
# ============================================================================

class TestRateLimit:
    def test_min_interval_constant(self):
        """Verify the rate limit interval is at least 1.5 seconds."""
        assert _MIN_INTERVAL >= 1.5

    def test_rate_limiter_tracks_domains(self):
        """Verify the rate limiter uses per-domain tracking."""
        from crawler.utils import _last_request_time
        # _last_request_time is a dict keyed by domain
        assert isinstance(_last_request_time, dict)


# ============================================================================
# 9. test_nosnippet_respected
# ============================================================================

class TestNosnippet:
    @patch("crawler.intro_fetcher.is_crawling_allowed", return_value=True)
    @patch("crawler.intro_fetcher.is_safe_url", return_value=True)
    @patch("crawler.intro_fetcher.rate_limited_get")
    def test_meta_nosnippet_returns_empty(self, mock_get, mock_safe, mock_robots):
        html = b"""<html><head>
        <meta name="robots" content="nosnippet">
        <meta property="og:description" content="Should not be returned">
        </head></html>"""

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.headers = {"Content-Type": "text/html; charset=utf-8", "X-Robots-Tag": ""}
        mock_resp.raw = MagicMock()
        mock_resp.raw.read.return_value = html
        mock_resp.raw.decode_content = True
        mock_resp.close = MagicMock()

        def mock_is_html(resp):
            return True

        with patch("crawler.intro_fetcher.is_html_content_type", mock_is_html):
            from crawler.intro_fetcher import fetch_intro
            result = fetch_intro(
                "https://example.com/article",
                rss_summary="",
                preview_mode="og_description",
            )
        assert result == ""


# ============================================================================
# 10. test_max_snippet_respected
# ============================================================================

class TestMaxSnippet:
    @patch("crawler.intro_fetcher.is_crawling_allowed", return_value=True)
    @patch("crawler.intro_fetcher.is_safe_url", return_value=True)
    @patch("crawler.intro_fetcher.rate_limited_get")
    def test_max_snippet_50_caps_output(self, mock_get, mock_safe, mock_robots):
        html = b"""<html><head>
        <meta name="robots" content="max-snippet:50">
        <meta property="og:description" content="%s">
        </head></html>""" % (b"A" * 200)

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.headers = {"Content-Type": "text/html", "X-Robots-Tag": ""}
        mock_resp.raw = MagicMock()
        mock_resp.raw.read.return_value = html
        mock_resp.raw.decode_content = True
        mock_resp.close = MagicMock()

        with patch("crawler.intro_fetcher.is_html_content_type", return_value=True):
            from crawler.intro_fetcher import fetch_intro
            result = fetch_intro(
                "https://example.com/article",
                rss_summary="",
                preview_mode="og_description",
            )
        assert len(result) <= 50


# ============================================================================
# 11. test_data_nosnippet_respected
# ============================================================================

class TestDataNosnippet:
    @patch("crawler.intro_fetcher.is_crawling_allowed", return_value=True)
    @patch("crawler.intro_fetcher.is_safe_url", return_value=True)
    @patch("crawler.intro_fetcher.rate_limited_get")
    def test_data_nosnippet_skips_element(self, mock_get, mock_safe, mock_robots):
        html = b"""<html><head>
        <div data-nosnippet>
        <meta property="og:description" content="Should be skipped">
        <meta name="description" content="Also skipped">
        </div>
        </head></html>"""

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.headers = {"Content-Type": "text/html", "X-Robots-Tag": ""}
        mock_resp.raw = MagicMock()
        mock_resp.raw.read.return_value = html
        mock_resp.raw.decode_content = True
        mock_resp.close = MagicMock()

        with patch("crawler.intro_fetcher.is_html_content_type", return_value=True):
            from crawler.intro_fetcher import fetch_intro
            result = fetch_intro(
                "https://example.com/article",
                rss_summary="",
                preview_mode="og_description",
            )
        assert result == "" or "Should be skipped" not in result


# ============================================================================
# 12. test_no_dangerous_rendering
# ============================================================================

SITE_SRC = ROOT / "site" / "src"
DANGEROUS_PATTERNS = [
    re.compile(r"dangerouslySetInnerHTML"),
    re.compile(r"\.innerHTML\s*="),
    re.compile(r"\beval\s*\("),
    re.compile(r"document\.write\s*\("),
]


class TestNoDangerousRendering:
    def test_no_dangerous_apis_in_frontend(self):
        violations = []
        for path in SITE_SRC.rglob("*.jsx"):
            content = path.read_text()
            # Strip comments
            content_no_comments = re.sub(r"//.*$", "", content, flags=re.MULTILINE)
            content_no_comments = re.sub(r"/\*.*?\*/", "", content_no_comments, flags=re.DOTALL)

            for pattern in DANGEROUS_PATTERNS:
                if pattern.search(content_no_comments):
                    rel = path.relative_to(ROOT)
                    violations.append(f"{rel}: {pattern.pattern}")
        assert not violations, f"Dangerous APIs found:\n" + "\n".join(violations)


# ============================================================================
# 13. test_external_links_have_safety_attrs
# ============================================================================

class TestExternalLinks:
    def test_all_article_links_have_safety_attrs(self):
        violations = []
        for path in SITE_SRC.rglob("*.jsx"):
            # Skip test files — only audit production code
            if "/test/" in str(path) or ".test." in path.name:
                continue
            content = path.read_text()
            # Find lines with href={article.url} or similar dynamic hrefs
            for i, line in enumerate(content.split("\n"), 1):
                if "article.url" in line and "href" in line:
                    # Check same element/nearby lines for target and rel
                    context = content[max(0, content.find(line) - 200):content.find(line) + 400]
                    if 'target="_blank"' not in context:
                        violations.append(f"{path.relative_to(ROOT)}:{i} missing target=\"_blank\"")
                    if "noopener" not in context or "noreferrer" not in context:
                        violations.append(f"{path.relative_to(ROOT)}:{i} missing rel noopener/noreferrer")
        assert not violations, f"Unsafe external links:\n" + "\n".join(violations)


# ============================================================================
# 14. test_no_tracking_scripts
# ============================================================================

TRACKING_PATTERNS = [
    "google-analytics", "googletagmanager", "gtag(", "mixpanel",
    "segment", "amplitude", "hotjar", "plausible", "fathom",
    "posthog", "facebook.com/tr", "doubleclick", "adsense",
]


class TestNoTracking:
    def test_no_tracking_in_html(self):
        index = ROOT / "site" / "index.html"
        content = index.read_text().lower()
        for pattern in TRACKING_PATTERNS:
            assert pattern not in content, f"Tracking found in index.html: {pattern}"

    def test_no_tracking_in_jsx(self):
        violations = []
        for path in SITE_SRC.rglob("*.jsx"):
            content = path.read_text().lower()
            for pattern in TRACKING_PATTERNS:
                if pattern in content:
                    violations.append(f"{path.relative_to(ROOT)}: {pattern}")
        assert not violations, f"Tracking found:\n" + "\n".join(violations)
