# ---------------------------------------------------------------------------
# Tests for crawler.openalex_adapter
# ---------------------------------------------------------------------------

import pytest

from crawler.openalex_adapter import (
    _extract_abstract,
    _classify_venue_type,
    _format_authors,
    _format_intro,
)


class TestExtractAbstract:
    def test_empty_index(self):
        assert _extract_abstract(None) == ""
        assert _extract_abstract({}) == ""

    def test_simple_index(self):
        index = {"Hello": [0], "world": [1], "of": [2], "AI": [3]}
        result = _extract_abstract(index)
        assert result == "Hello world of AI"

    def test_caps_at_500_chars(self):
        # Create a long abstract
        index = {f"word{i}": [i] for i in range(200)}
        result = _extract_abstract(index)
        assert len(result) <= 500


class TestClassifyVenueType:
    def test_preprint(self):
        work = {"type": "preprint"}
        assert _classify_venue_type(work) == "preprint"

    def test_repository_is_preprint(self):
        work = {
            "type": "article",
            "primary_location": {"source": {"type": "repository"}},
        }
        assert _classify_venue_type(work) == "preprint"

    def test_journal_article(self):
        work = {
            "type": "article",
            "primary_location": {"source": {"type": "journal"}},
        }
        assert _classify_venue_type(work) == "journal"

    def test_conference_article(self):
        work = {
            "type": "article",
            "primary_location": {"source": {"type": "conference"}},
        }
        assert _classify_venue_type(work) == "conference"

    def test_unknown_type(self):
        work = {"type": "editorial"}
        assert _classify_venue_type(work) == "unknown"


class TestFormatAuthors:
    def test_empty(self):
        assert _format_authors([]) == ""
        assert _format_authors(None) == ""

    def test_single_author(self):
        authors = [{"author": {"display_name": "Jane Smith"}}]
        assert _format_authors(authors) == "Jane Smith"

    def test_multiple_authors_truncated(self):
        authors = [
            {"author": {"display_name": f"Author {i}"}}
            for i in range(10)
        ]
        result = _format_authors(authors, max_authors=3)
        assert "Author 0" in result
        assert "Author 2" in result
        assert "et al." in result
        assert "10 authors" in result

    def test_respects_max_authors(self):
        authors = [
            {"author": {"display_name": "A"}},
            {"author": {"display_name": "B"}},
        ]
        result = _format_authors(authors, max_authors=3)
        assert "et al." not in result


class TestFormatIntro:
    def test_with_all_fields(self):
        work = {
            "authorships": [
                {"author": {"display_name": "Alice"}},
                {"author": {"display_name": "Bob"}},
            ],
            "primary_location": {
                "source": {"display_name": "Nature"}
            },
            "publication_year": 2026,
            "abstract_inverted_index": {"Test": [0], "abstract": [1]},
        }
        result = _format_intro(work)
        assert "Alice" in result
        assert "Nature" in result
        assert "2026" in result
        assert "Test abstract" in result

    def test_caps_at_300(self):
        work = {
            "authorships": [{"author": {"display_name": f"Author{i}"}} for i in range(50)],
            "abstract_inverted_index": {f"word{i}": [i] for i in range(100)},
        }
        result = _format_intro(work)
        assert len(result) <= 300

    def test_empty_work(self):
        result = _format_intro({})
        assert result == ""
